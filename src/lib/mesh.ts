/**
 * The agent mesh runtime.
 *
 * Responsibilities:
 *   - Holds an in-memory BrokerSim + per-agent state
 *   - Runs each of the 4 agents on its own mini-loop (setInterval)
 *   - Implements the Monitor -> Reason -> Act -> Learn pattern with
 *     observable outputs at each step
 *   - Implements deliberate kill() / restart() of any agent and replays
 *     missed events from the last committed offset
 *   - Publishes WireEvents on the EventBus for the SSE stream
 *
 * Stored on globalThis so it survives Next.js HMR and is shared across
 * route handlers in the same Node process.
 */

import { AGENTS } from "./agents-config";
import { BrokerSim } from "./broker";
import { getEventBus } from "./event-bus";
import { getKafkaTap } from "./kafka/tap";
import { findTool, MCP_TOOLS } from "./mcp";
import type {
  ActionResult,
  AgentId,
  AgentRuntimeState,
  ApprovalRequest,
  AuditEvent,
  IncidentEvent,
  KafkaRecord,
  LessonRecord,
  McpToolCall,
  MetricsSignal,
  NotificationEvent,
  ReasoningOutput,
  SnapshotPayload,
  TopicName,
  WireEvent,
} from "./types";

const CONSUMER_GROUP: Record<AgentId, string> = {
  "intake-agent": "intake-cg",
  "monitor-agent": "monitor-cg",
  "writer-agent": "writer-cg",
  "notification-agent": "notification-cg",
};

const NEW_AGENT_STATE = (): AgentRuntimeState => ({
  status: "online",
  consumerLag: {},
  committedOffsets: {},
  inflight: 0,
  processed: 0,
  killed: false,
  startedAt: Date.now(),
});

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export class Mesh {
  broker: BrokerSim;
  agents: Record<AgentId, AgentRuntimeState>;
  approvals: ApprovalRequest[] = [];
  audit: AuditEvent[] = [];
  notifications: NotificationEvent[] = [];
  lessons: LessonRecord[] = [];
  incidents: IncidentEvent[] = [];

  /** When > 0, the broker keeps emitting synthetic metric signals each tick. */
  private metricsCampaign:
    | {
        kind: MetricsSignal["kafkaFeature"];
        ttl: number;
        lagBase: number;
        group: string;
        rebalanceOverride?: MetricsSignal["rebalanceState"];
      }
    | null = null;

  /** Internal tick interval handle. */
  private tick?: ReturnType<typeof setInterval>;

  constructor() {
    this.broker = new BrokerSim();
    // Wire the simulator to the optional KafkaJS tap so that, when in real
    // mode, every record the agents produce is also written to the real
    // Strimzi-managed cluster (and every record arriving on the cluster
    // is mirrored back into the simulator). No-op when the tap is disabled.
    getKafkaTap().attachBroker(this.broker);
    this.agents = {
      "intake-agent": NEW_AGENT_STATE(),
      "monitor-agent": NEW_AGENT_STATE(),
      "writer-agent": NEW_AGENT_STATE(),
      "notification-agent": NEW_AGENT_STATE(),
    };
    this.startLoop();
  }

  /** Append to the simulator AND mirror to real Kafka via the tap (no-op
   *  unless the tap is enabled by the Setup Wizard / mode endpoint). */
  private appendBoth<T>(topic: TopicName, key: string, value: T): KafkaRecord<T> {
    const rec = this.broker.append(topic, key, value);
    getKafkaTap().publish(topic, key, value);
    return rec;
  }

  /* ---------------------------------------------------------------- */
  /* Snapshot for new SSE clients                                     */
  /* ---------------------------------------------------------------- */

  snapshot(): SnapshotPayload {
    const topics: SnapshotPayload["topics"] = {} as never;
    for (const t of [
      "ops.requests.v1",
      "ops.kafka.metrics.v1",
      "ops.incidents.v1",
      "ops.actions.audit.v1",
      "ops.lessons.v1",
      "ops.notifications.v1",
    ] as TopicName[]) {
      const ends = this.broker.getLogEndOffsets(t);
      topics[t] = {
        partitions: ends.length,
        logEndOffset: ends.reduce((a, b) => a + b, 0),
        recentRecords: this.broker.recent(t, 30),
      };
    }
    return {
      agents: this.agents,
      approvals: this.approvals.slice(-25),
      incidents: this.incidents.slice(-25),
      audit: this.audit.slice(-100),
      notifications: this.notifications.slice(-25),
      lessons: this.lessons.slice(-25),
      topics,
      cluster: this.broker.getClusterStatus(),
    };
  }

  /* ---------------------------------------------------------------- */
  /* Public API: scenarios + agent lifecycle                          */
  /* ---------------------------------------------------------------- */

  killAgent(id: AgentId): void {
    const a = this.agents[id];
    if (a.killed) return;
    a.killed = true;
    a.status = "crashed";
    this.emit({ kind: "agent-state", payload: { agent: id, state: a } });
    this.audit_(id, "agent-kill", `${AGENTS[id].name} killed manually for replay demo.`);
    this.log("warn", id, `Agent crashed (manual kill). Events will accumulate; replay on restart.`);
  }

  restartAgent(id: AgentId): void {
    const a = this.agents[id];
    if (!a.killed && a.status !== "crashed" && a.status !== "offline") return;
    a.killed = false;
    a.status = "replaying";
    a.startedAt = Date.now();
    this.emit({ kind: "agent-state", payload: { agent: id, state: a } });
    this.audit_(id, "agent-restart", `${AGENTS[id].name} restarted - replaying from last committed offset.`);
    this.audit_(id, "replay-start", `Replay started for ${id}`);
    this.log("info", id, `Restart - resuming consumer group ${CONSUMER_GROUP[id]} from last committed offset...`);

    // Trigger an immediate replay catch-up so the audience sees lag drain.
    setTimeout(() => this.replayCatchup(id), 250);
  }

  reset(): void {
    this.broker.resetAll();
    this.agents = {
      "intake-agent": NEW_AGENT_STATE(),
      "monitor-agent": NEW_AGENT_STATE(),
      "writer-agent": NEW_AGENT_STATE(),
      "notification-agent": NEW_AGENT_STATE(),
    };
    this.approvals = [];
    this.audit = [];
    this.notifications = [];
    this.lessons = [];
    this.incidents = [];
    this.metricsCampaign = null;
    this.emit({ kind: "snapshot", payload: this.snapshot() });
    this.log("info", "system", "Mesh reset. All topics cleared.");
  }

  /**
   * Trigger a full demo scenario. Each scenario pushes a request through
   * Intake and primes the metrics stream so Monitor reasons over it.
   */
  triggerScenario(
    kind: "lag-spike" | "controller-failover" | "share-group-rebalance" | "partition-imbalance"
  ): { requestId: string } {
    const reqId = rid("req");
    const tool = findTool("intake.submitOpsRequest")!;

    // Intake's MCP tool call
    const toolCall: McpToolCall = {
      jsonrpc: "2.0",
      id: rid("rpc"),
      method: "tools/call",
      params: { name: tool.name, arguments: { kind, requestId: reqId } },
    };
    this.audit_("intake-agent", "tool-call", `MCP ${tool.name}`, { toolCall });

    // Publish to ops.requests.v1
    const rec = this.appendBoth("ops.requests.v1", reqId, {
      requestId: reqId,
      kind,
      actor: "operator@acme",
      createdAt: new Date().toISOString(),
    });
    this.emitProduce("intake-agent", "monitor-agent", "ops.requests.v1", rec, "cyan");
    this.audit_("intake-agent", "publish", `ops.requests.v1 partition=${rec.partition} offset=${rec.offset}`);

    // Prime metrics stream so Monitor reasons over the right scenario.
    // Each scenario produces a deterministic outcome so the demo is reliable on stage.
    if (kind === "lag-spike") {
      // sustained real backlog -> Monitor proposes scale-consumers with approval gate
      this.metricsCampaign = { kind: "KIP-848", ttl: 4, lagBase: 24_000, group: "payments-consumer", rebalanceOverride: "stable" };
    } else if (kind === "controller-failover") {
      // KRaft leadership change -> agent acknowledges, no paging, no approval
      this.broker.forceControllerFailover();
      this.metricsCampaign = { kind: "KRaft", ttl: 2, lagBase: 600, group: "ledger-consumer", rebalanceOverride: "stable" };
    } else if (kind === "share-group-rebalance") {
      // KIP-932 share group rebalance -> agent proposes share-group checkpoint with approval
      this.metricsCampaign = { kind: "KIP-932", ttl: 3, lagBase: 1_800, group: "claims-share-group", rebalanceOverride: "share-group-assigning" };
    } else {
      // partition-imbalance == "benign rebalance" demo: lag rises during healthy KIP-848
      // cooperative rebalance -> agent SUPPRESSES the page (no approval, no scale)
      this.metricsCampaign = { kind: "KIP-848", ttl: 3, lagBase: 8_000, group: "checkout-consumer", rebalanceOverride: "preparing-rebalance" };
    }

    // Pre-emit the first synthetic metric so Monitor has a signal to reason over
    // when the request is consumed on the very next tick.
    if (this.metricsCampaign) this.emitMetricSignal(this.metricsCampaign);

    return { requestId: reqId };
  }

  decideApproval(approvalId: string, decision: "approved" | "rejected", actor: string): void {
    const a = this.approvals.find((x) => x.id === approvalId);
    if (!a || a.status !== "pending") return;
    a.status = decision;
    a.decidedAt = Date.now();
    a.decidedBy = actor;
    this.emit({ kind: "approval-update", payload: a });
    this.audit_(a.proposedBy, "approval-decision", `${decision.toUpperCase()} by ${actor} for ${a.toolCall.params.name}`, {
      approval: a,
    });

    if (decision === "approved") {
      this.executeApprovedToolCall(a);
    } else {
      // Reject path: log and continue
      const monitor = this.agents["monitor-agent"];
      monitor.status = "online";
      this.emit({ kind: "agent-state", payload: { agent: "monitor-agent", state: monitor } });
      this.log("warn", "monitor-agent", `Tool call ${a.toolCall.params.name} REJECTED - no remediation executed.`);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Internal loop                                                    */
  /* ---------------------------------------------------------------- */

  private startLoop(): void {
    // Tick every 700ms; agents act probabilistically per tick.
    this.tick = setInterval(() => this.runTick().catch(() => {}), 700);
  }

  private async runTick(): Promise<void> {
    // 1) Synthetic metrics if a campaign is active
    if (this.metricsCampaign && this.metricsCampaign.ttl > 0) {
      this.emitMetricSignal(this.metricsCampaign);
      this.metricsCampaign.ttl -= 1;
      if (this.metricsCampaign.ttl <= 0) this.metricsCampaign = null;
    }

    // 2) Each agent processes one batch
    if (!this.agents["intake-agent"].killed) await this.runIntake();
    if (!this.agents["monitor-agent"].killed) await this.runMonitor();
    if (!this.agents["writer-agent"].killed) await this.runWriter();
    if (!this.agents["notification-agent"].killed) await this.runNotification();

    // 3) Update lag metrics for all agents on every tick
    this.refreshAllAgentLag();
  }

  private refreshAllAgentLag(): void {
    for (const id of Object.keys(this.agents) as AgentId[]) {
      const def = AGENTS[id];
      const lagMap: Record<string, number> = {};
      const offsetMap: Record<string, number> = {};
      for (const t of def.consumes) {
        lagMap[t] = this.broker.getLag(CONSUMER_GROUP[id], t);
        offsetMap[t] = this.broker.getCommittedOffsets(CONSUMER_GROUP[id], t).reduce((a, b) => a + b, 0);
      }
      const a = this.agents[id];
      a.consumerLag = lagMap;
      a.committedOffsets = offsetMap;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Per-agent runtimes                                               */
  /* ---------------------------------------------------------------- */

  private async runIntake(): Promise<void> {
    // Intake's job is just to emit on demand via triggerScenario - nothing periodic
  }

  private async runMonitor(): Promise<void> {
    const id: AgentId = "monitor-agent";
    const a = this.agents[id];

    // Don't start a new reasoning cycle if we're awaiting approval or already mid-cycle.
    if (a.status === "awaiting-approval" || a.status === "reasoning" || a.status === "acting") return;

    // Consume from ops.requests.v1 (operator-driven scenarios)
    const reqs = this.broker.poll(CONSUMER_GROUP[id], "ops.requests.v1", 1);
    const metrics = this.broker.poll(CONSUMER_GROUP[id], "ops.kafka.metrics.v1", 5);

    // Acknowledge received metrics regardless (they're advisory, not required)
    if (metrics.length > 0) {
      this.broker.commitOffsets(CONSUMER_GROUP[id], "ops.kafka.metrics.v1", metrics);
    }

    if (reqs.length === 0) return;

    // 1) Reason
    a.status = "reasoning";
    this.emit({ kind: "agent-state", payload: { agent: id, state: a } });

    const signal = (metrics[metrics.length - 1]?.value as MetricsSignal) ?? this.fallbackSignal();
    const recentLessons = this.lessons.slice(-3);
    await this.delay(800); // dramatic pause for the audience
    const reasoning = this.reason(signal, recentLessons, reqs[0]);
    a.lastReasoning = reasoning;
    this.audit_(id, "consume", `ops.requests.v1 partition=${reqs[0].partition} offset=${reqs[0].offset}`);
    this.log("info", id, `Reasoning: ${reasoning.rootCause} (confidence ${(reasoning.confidence * 100).toFixed(0)}%)`);

    // 2) Either request approval or act directly
    if (reasoning.requiresApproval) {
      const approval: ApprovalRequest = {
        id: rid("appr"),
        createdAt: Date.now(),
        toolCall: reasoning.proposedToolCall,
        reason: reasoning.rationale,
        proposedBy: id,
        riskLevel: "high",
        status: "pending",
      };
      this.approvals.push(approval);
      a.status = "awaiting-approval";
      this.broker.commitOffsets(CONSUMER_GROUP[id], "ops.requests.v1", reqs);
      this.emit({ kind: "approval-new", payload: approval });
      this.emit({ kind: "agent-state", payload: { agent: id, state: a } });
      this.log("warn", id, `Awaiting human approval for ${reasoning.proposedToolCall.params.name}`);
      // Stash request so we can finish after approval
      (a as AgentRuntimeState & { _pending?: KafkaRecord<unknown>[] })._pending = reqs;
      return;
    }

    // No approval needed - act immediately
    const action = await this.act(reasoning, reqs[0]);
    a.lastAction = action;
    a.processed += 1;
    a.status = "learning";
    this.broker.commitOffsets(CONSUMER_GROUP[id], "ops.requests.v1", reqs);
    this.publishIncident(reasoning, action, signal, reqs[0]);
    this.emit({ kind: "agent-state", payload: { agent: id, state: a } });

    setTimeout(() => this.learn(reasoning, action), 4_500);
  }

  private async runWriter(): Promise<void> {
    const id: AgentId = "writer-agent";
    const a = this.agents[id];
    if (a.status === "reasoning" || a.status === "acting" || a.status === "replaying") {
      // even when replaying, we want to drain
    }

    const incidents = this.broker.poll(CONSUMER_GROUP[id], "ops.incidents.v1", 5);
    if (incidents.length === 0) {
      if (a.status === "replaying") {
        a.status = "online";
        this.emit({ kind: "agent-state", payload: { agent: id, state: a } });
        this.audit_(id, "replay-complete", "Replay complete - caught up to latest offset.");
      }
      return;
    }

    a.status = a.status === "replaying" ? "replaying" : "acting";
    this.emit({ kind: "agent-state", payload: { agent: id, state: a } });

    for (const rec of incidents) {
      const incident = rec.value as IncidentEvent;
      this.emitConsume("monitor-agent", id, "ops.incidents.v1", rec, "violet");
      this.audit_(id, "consume", `ops.incidents.v1 partition=${rec.partition} offset=${rec.offset}`);
      await this.delay(380);

      const tool = findTool("writer.draftIncidentReport")!;
      const tc: McpToolCall = {
        jsonrpc: "2.0",
        id: rid("rpc"),
        method: "tools/call",
        params: { name: tool.name, arguments: { incidentId: incident.id } },
      };
      this.audit_(id, "tool-call", `MCP ${tool.name} for incident=${incident.id}`, { toolCall: tc });

      const md = this.draftIncidentMarkdown(incident);
      const audited = this.appendBoth("ops.actions.audit.v1", incident.id, {
        kind: "incident-report",
        incidentId: incident.id,
        markdown: md,
        wordCount: md.split(/\s+/).length,
      });
      this.emitProduce(id, "notification-agent", "ops.actions.audit.v1", audited, "emerald");
      this.audit_(id, "publish", `ops.actions.audit.v1 partition=${audited.partition} offset=${audited.offset}`);
      a.processed += 1;
    }

    this.broker.commitOffsets(CONSUMER_GROUP[id], "ops.incidents.v1", incidents);
    if (a.status !== "replaying") {
      a.status = "online";
      this.emit({ kind: "agent-state", payload: { agent: id, state: a } });
    }
  }

  private async runNotification(): Promise<void> {
    const id: AgentId = "notification-agent";
    const a = this.agents[id];

    const recs = this.broker.poll(CONSUMER_GROUP[id], "ops.actions.audit.v1", 5);
    const reports = recs.filter(
      (r) => (r.value as { kind?: string })?.kind === "incident-report"
    );
    if (reports.length === 0) {
      // commit non-report records so they don't accumulate as fake lag
      if (recs.length) this.broker.commitOffsets(CONSUMER_GROUP[id], "ops.actions.audit.v1", recs);
      return;
    }

    a.status = "acting";
    this.emit({ kind: "agent-state", payload: { agent: id, state: a } });

    for (const rec of reports) {
      this.emitConsume("writer-agent", id, "ops.actions.audit.v1", rec, "amber");
      const v = rec.value as { incidentId: string; markdown: string };

      // Slack
      await this.delay(280);
      const slackTool = findTool("notify.slack")!;
      this.audit_(id, "tool-call", `MCP ${slackTool.name}`, {
        toolCall: { name: slackTool.name, args: { channel: "#sre-incidents", incidentId: v.incidentId } },
      });
      const slackNote: NotificationEvent = {
        id: rid("note"),
        ts: Date.now(),
        channel: "slack",
        title: "Incident summary posted to #sre-incidents",
        body: v.markdown.split("\n").slice(0, 3).join("\n"),
        link: `https://slack.example/sre-incidents/${v.incidentId}`,
      };
      this.notifications.push(slackNote);
      this.emit({ kind: "notification", payload: slackNote });

      // ITSM
      await this.delay(220);
      const itsmTool = findTool("itsm.openTicket")!;
      this.audit_(id, "tool-call", `MCP ${itsmTool.name}`, {
        toolCall: { name: itsmTool.name, args: { incidentId: v.incidentId } },
      });
      const ticket: NotificationEvent = {
        id: rid("note"),
        ts: Date.now(),
        channel: "itsm",
        title: `ServiceNow INC-${Math.floor(Math.random() * 9_000_000) + 1_000_000}`,
        body: `Auto-opened from agent mesh for incident ${v.incidentId}`,
        link: `https://servicenow.example/inc/${v.incidentId}`,
      };
      this.notifications.push(ticket);
      this.emit({ kind: "notification", payload: ticket });

      // publish to ops.notifications.v1 to close the loop
      const out = this.appendBoth("ops.notifications.v1", v.incidentId, {
        slack: slackNote,
        itsm: ticket,
      });
      this.emitProduce(id, "notification-agent", "ops.notifications.v1", out, "amber");
      a.processed += 1;
    }

    // commit *all* records consumed (reports and others)
    this.broker.commitOffsets(CONSUMER_GROUP[id], "ops.actions.audit.v1", recs);
    a.status = "online";
    this.emit({ kind: "agent-state", payload: { agent: id, state: a } });
  }

  /** Drain whatever queued up while an agent was killed. */
  private async replayCatchup(id: AgentId): Promise<void> {
    if (id === "writer-agent") {
      const a = this.agents[id];
      a.status = "replaying";
      this.emit({ kind: "agent-state", payload: { agent: id, state: a } });
      // The next ticks will drain it; runWriter will set status back to "online"
    } else if (id === "monitor-agent") {
      const a = this.agents[id];
      a.status = "replaying";
      this.emit({ kind: "agent-state", payload: { agent: id, state: a } });
    } else if (id === "notification-agent") {
      const a = this.agents[id];
      a.status = "replaying";
      this.emit({ kind: "agent-state", payload: { agent: id, state: a } });
    } else {
      const a = this.agents[id];
      a.status = "online";
      this.emit({ kind: "agent-state", payload: { agent: id, state: a } });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Reasoning + Action + Learning                                    */
  /* ---------------------------------------------------------------- */

  private reason(
    signal: MetricsSignal,
    recentLessons: LessonRecord[],
    request: KafkaRecord
  ): ReasoningOutput {
    const requestKind = (request.value as { kind?: string }).kind ?? "lag-spike";
    const lessonsBlurb =
      recentLessons.length > 0
        ? `Last ${recentLessons.length} lessons informed this prompt: ${recentLessons
            .map((l) => `${l.actionTaken}/${l.effective ? "effective" : "ineffective"}`)
            .join(", ")}.`
        : "No prior lessons available; reasoning from baseline.";

    if (requestKind === "controller-failover") {
      return {
        rootCause:
          "KRaft controller leadership change detected (epoch increased). Lag dipped briefly during failover but ISR is still in sync.",
        confidence: 0.94,
        recommendedAction: "controller-failover-ack",
        rationale: `Healthy KRaft failover - no remediation required. ${lessonsBlurb}`,
        requiresApproval: false,
        kafkaFeatureCited: "KRaft",
        proposedToolCall: {
          jsonrpc: "2.0",
          id: rid("rpc"),
          method: "tools/call",
          params: {
            name: "kafka.acknowledgeFailover",
            arguments: {
              fromController: 1,
              toController: this.broker.getClusterStatus().controllerId,
              epoch: this.broker.getClusterStatus().controllerEpoch,
            },
          },
        },
      };
    }

    if (requestKind === "share-group-rebalance") {
      return {
        rootCause:
          "KIP-932 share group offsets diverging during in-flight assignment. Standard consumer-group thresholds do not apply.",
        confidence: 0.86,
        recommendedAction: "share-group-rebalance-ack",
        rationale: `Share-group rebalance is in 'share-group-assigning' state. Threshold-based pages would false-positive. Cross-checking with prior lessons. ${lessonsBlurb}`,
        requiresApproval: true,
        kafkaFeatureCited: "KIP-932",
        proposedToolCall: {
          jsonrpc: "2.0",
          id: rid("rpc"),
          method: "tools/call",
          params: {
            name: "kafka.shareGroupCheckpoint",
            arguments: { shareGroup: signal.consumerGroup },
          },
        },
      };
    }

    // Default: lag spike -> recommend scaling consumers
    const isHealthyRebalance = signal.rebalanceState === "preparing-rebalance" ||
      signal.rebalanceState === "completing-rebalance";
    if (isHealthyRebalance) {
      return {
        rootCause:
          "Lag spike correlates with KIP-848 cooperative rebalance in progress. This is expected churn, not a real backlog.",
        confidence: 0.91,
        recommendedAction: "rebalance-wait",
        rationale: `Static alerts would page; the agent cross-references rebalance state and suppresses. ${lessonsBlurb}`,
        requiresApproval: false,
        kafkaFeatureCited: "KIP-848",
        proposedToolCall: {
          jsonrpc: "2.0",
          id: rid("rpc"),
          method: "tools/call",
          params: { name: "kafka.acknowledgeFailover", arguments: { fromController: 0, toController: 0, epoch: 0 } },
        },
      };
    }

    return {
      rootCause: `Sustained consumer lag (~${signal.lagMessages.toLocaleString()} msgs) on ${signal.consumerGroup}. ISR=${signal.isrCount}, JVM heap=${signal.jvmHeapPercent.toFixed(0)}%, pod CPU=${signal.podCpuPercent.toFixed(0)}%.`,
      confidence: 0.88,
      recommendedAction: "scale-consumers",
      rationale: `Cross-checked rebalance state (=stable) and KRaft epoch (no change). Backlog is real. Proposing N -> N+2 scale. ${lessonsBlurb}`,
      requiresApproval: true,
      kafkaFeatureCited: signal.kafkaFeature === "classic" ? "KIP-848" : signal.kafkaFeature,
      proposedToolCall: {
        jsonrpc: "2.0",
        id: rid("rpc"),
        method: "tools/call",
        params: {
          name: "kafka.scaleConsumers",
          arguments: {
            consumerGroup: signal.consumerGroup,
            delta: 2,
            reason: `Sustained lag ~${signal.lagMessages} msgs over polling window`,
          },
        },
      },
    };
  }

  private async act(
    reasoning: ReasoningOutput,
    request: KafkaRecord
  ): Promise<ActionResult> {
    const id: AgentId = "monitor-agent";
    const a = this.agents[id];
    a.status = "acting";
    this.emit({ kind: "agent-state", payload: { agent: id, state: a } });
    await this.delay(500);

    const lagBefore = this.metricsCampaign?.lagBase ?? 0;
    const tool = findTool(reasoning.proposedToolCall.params.name);
    const success = !!tool;
    this.audit_(id, "tool-call", `MCP ${reasoning.proposedToolCall.params.name}`, {
      toolCall: reasoning.proposedToolCall,
      requiresApproval: reasoning.requiresApproval,
    });

    const result: ActionResult = {
      toolCall: reasoning.proposedToolCall,
      approved: !reasoning.requiresApproval,
      executedAt: Date.now(),
      outcome: success ? "success" : "noop",
      detail:
        reasoning.recommendedAction === "scale-consumers"
          ? `Scaled ${(reasoning.proposedToolCall.params.arguments as { consumerGroup: string }).consumerGroup} from N to N+2 via Strimzi CRD.`
          : reasoning.recommendedAction === "controller-failover-ack"
          ? "Acknowledged KRaft failover - paging suppressed."
          : reasoning.recommendedAction === "rebalance-wait"
          ? "Suppressed false-positive page during KIP-848 cooperative rebalance."
          : "Share group checkpointed.",
      lagBefore,
      lagAfter: Math.max(0, Math.floor(lagBefore * 0.12)),
    };
    void request;
    return result;
  }

  /** Execute a tool call that was previously held pending an approval. */
  private async executeApprovedToolCall(approval: ApprovalRequest): Promise<void> {
    const id: AgentId = "monitor-agent";
    const a = this.agents[id];
    const reasoning = a.lastReasoning;
    if (!reasoning) return;
    const pending = (a as AgentRuntimeState & { _pending?: KafkaRecord<unknown>[] })._pending ?? [];
    const result = await this.act({ ...reasoning, requiresApproval: false, proposedToolCall: approval.toolCall }, pending[0]);
    result.approved = true;
    result.approvedBy = approval.decidedBy;
    a.lastAction = result;
    a.processed += 1;
    a.status = "learning";
    this.emit({ kind: "agent-state", payload: { agent: id, state: a } });
    this.publishIncident(reasoning, result, this.fallbackSignal(), pending[0]);
    setTimeout(() => this.learn(reasoning, result), 4_500);
  }

  private learn(reasoning: ReasoningOutput, action: ActionResult): void {
    const lesson: LessonRecord = {
      id: rid("lsn"),
      ts: Date.now(),
      scenario: reasoning.kafkaFeatureCited,
      actionTaken: reasoning.proposedToolCall.params.name,
      effective: (action.lagAfter ?? 0) < (action.lagBefore ?? 0) * 0.5,
      lagBefore: action.lagBefore ?? 0,
      lagAfter: action.lagAfter ?? 0,
      adjustedThreshold:
        reasoning.recommendedAction === "scale-consumers"
          ? Math.round((action.lagBefore ?? 0) * 0.7)
          : undefined,
      notes: `Learned: ${reasoning.recommendedAction} in ${reasoning.kafkaFeatureCited} context.`,
    };
    this.lessons.push(lesson);

    // Publish to ops.lessons.v1 (the LEARN topic)
    const rec = this.appendBoth("ops.lessons.v1", lesson.id, lesson);
    this.emitProduce("monitor-agent", "monitor-agent", "ops.lessons.v1", rec, "violet");
    this.audit_("monitor-agent", "publish", `ops.lessons.v1 lesson=${lesson.id}`, { lesson });

    this.emit({ kind: "lesson", payload: lesson });
    const a = this.agents["monitor-agent"];
    a.status = "online";
    this.emit({ kind: "agent-state", payload: { agent: "monitor-agent", state: a } });
    this.log("info", "monitor-agent", `Learn: published lesson - effective=${lesson.effective}, threshold=${lesson.adjustedThreshold ?? "n/a"}`);
  }

  private publishIncident(
    reasoning: ReasoningOutput,
    action: ActionResult,
    signal: MetricsSignal,
    request: KafkaRecord
  ): void {
    const incident: IncidentEvent = {
      id: rid("inc"),
      ts: Date.now(),
      severity:
        reasoning.recommendedAction === "rebalance-wait" || reasoning.recommendedAction === "controller-failover-ack"
          ? "low"
          : "high",
      title:
        reasoning.recommendedAction === "scale-consumers"
          ? `Consumer lag spike on ${signal.consumerGroup}`
          : reasoning.recommendedAction === "controller-failover-ack"
          ? `KRaft controller failover ack`
          : reasoning.recommendedAction === "share-group-rebalance-ack"
          ? `KIP-932 share group rebalance`
          : `KIP-848 cooperative rebalance benign`,
      summary: reasoning.rootCause,
      signal,
      reasoning,
      action,
    };
    this.incidents.push(incident);
    const rec = this.appendBoth("ops.incidents.v1", incident.id, incident);
    this.emitProduce("monitor-agent", "writer-agent", "ops.incidents.v1", rec, "violet");
    this.audit_("monitor-agent", "publish", `ops.incidents.v1 partition=${rec.partition} offset=${rec.offset}`);
    this.emit({ kind: "incident", payload: incident });
    void request;
  }

  /* ---------------------------------------------------------------- */
  /* Helpers                                                          */
  /* ---------------------------------------------------------------- */

  private emitMetricSignal(c: NonNullable<Mesh["metricsCampaign"]>): void {
    const signal: MetricsSignal = {
      brokerId: 1 + Math.floor(Math.random() * 3),
      topic: "payments.events",
      partition: Math.floor(Math.random() * 6),
      consumerGroup: c.group,
      lagMessages: Math.max(0, Math.floor(c.lagBase * (0.6 + Math.random() * 0.5))),
      isrCount: 3,
      rebalanceState:
        c.rebalanceOverride ??
        (c.kind === "KIP-848"
          ? Math.random() < 0.5
            ? "preparing-rebalance"
            : "stable"
          : c.kind === "KIP-932"
          ? "share-group-assigning"
          : "stable"),
      controllerEpoch: this.broker.getClusterStatus().controllerEpoch,
      jvmHeapPercent: 55 + Math.random() * 20,
      podCpuPercent: 60 + Math.random() * 25,
      kafkaFeature: c.kind,
      noteForOperators: `Synthetic metric for demo (${c.kind})`,
    };
    const rec = this.appendBoth("ops.kafka.metrics.v1", `${c.group}.${signal.partition}`, signal);
    this.emitProduce("intake-agent", "monitor-agent", "ops.kafka.metrics.v1", rec, "cyan");
  }

  private fallbackSignal(): MetricsSignal {
    return {
      brokerId: 1,
      topic: "payments.events",
      partition: 0,
      consumerGroup: "payments-consumer",
      lagMessages: 0,
      isrCount: 3,
      rebalanceState: "stable",
      controllerEpoch: this.broker.getClusterStatus().controllerEpoch,
      jvmHeapPercent: 50,
      podCpuPercent: 50,
      kafkaFeature: "classic",
    };
  }

  private draftIncidentMarkdown(incident: IncidentEvent): string {
    const r = incident.reasoning;
    const a = incident.action;
    return [
      `# Incident ${incident.id}`,
      ``,
      `**Severity**: ${incident.severity}`,
      `**Kafka feature implicated**: ${r.kafkaFeatureCited}`,
      ``,
      `## Root Cause`,
      r.rootCause,
      ``,
      `## Reasoning`,
      r.rationale,
      ``,
      `## Action Taken`,
      a ? `- Tool: \`${a.toolCall.params.name}\`` : "- No action",
      a ? `- Outcome: ${a.outcome}` : "",
      a ? `- Detail: ${a.detail}` : "",
      a?.lagBefore != null ? `- Lag before: ${a.lagBefore.toLocaleString()} msgs` : "",
      a?.lagAfter != null ? `- Lag after: ${a.lagAfter.toLocaleString()} msgs` : "",
      ``,
      `## Audit`,
      `- This report is published to \`ops.actions.audit.v1\` (durable, replayable, compliance-ready).`,
      `- Approval gate: ${a?.approved ? `approved by ${a.approvedBy ?? "auto"}` : "not required"}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  private audit_(agent: AgentId | "system", kind: AuditEvent["kind"], detail: string, meta?: Record<string, unknown>): void {
    const e: AuditEvent = {
      id: rid("aud"),
      ts: Date.now(),
      agent: agent === "system" ? "monitor-agent" : agent,
      kind,
      detail,
      meta,
    };
    this.audit.push(e);
    if (this.audit.length > 500) this.audit.shift();
    this.emit({ kind: "audit", payload: e });
  }

  private log(level: "info" | "warn" | "error", agent: AgentId | "system", message: string): void {
    this.emit({ kind: "log", payload: { ts: Date.now(), agent, level, message } });
  }

  private emitProduce(source: AgentId, target: AgentId, topic: TopicName, rec: KafkaRecord, color: "cyan" | "violet" | "emerald" | "amber" | "rose" | "red"): void {
    this.emit({ kind: "topic-record", payload: rec });
    this.emit({
      kind: "particle",
      payload: { id: rid("prt"), source, target, topic, color, durationMs: 1100 },
    });
  }

  private emitConsume(source: AgentId, target: AgentId, topic: TopicName, rec: KafkaRecord, color: "cyan" | "violet" | "emerald" | "amber" | "rose" | "red"): void {
    void rec;
    this.emit({
      kind: "particle",
      payload: { id: rid("prt"), source, target, topic, color, durationMs: 900 },
    });
  }

  private emit(e: WireEvent): void {
    getEventBus().publish(e);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __agentMesh: Mesh | undefined;
}

export function getMesh(): Mesh {
  if (!globalThis.__agentMesh) {
    globalThis.__agentMesh = new Mesh();
  }
  return globalThis.__agentMesh;
}

export { MCP_TOOLS };
