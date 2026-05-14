/**
 * Core types for the Agent Mesh on Streaming World demo.
 *
 * These types model the key abstractions called out in the API Days proposal:
 *  - Kafka topics (channels), partitions, offsets
 *  - Agents with MCP tool definitions
 *  - Reasoning steps (Monitor -> Reason -> Act -> Learn)
 *  - Policy gates (human-in-the-loop)
 *  - AsyncAPI 3.0 channel contracts
 */

export type AgentId =
  | "intake-agent"
  | "monitor-agent"
  | "writer-agent"
  | "notification-agent";

export type AgentStatus =
  | "online"
  | "starting"
  | "reasoning"
  | "acting"
  | "learning"
  | "awaiting-approval"
  | "crashed"
  | "replaying"
  | "offline";

export type TopicName =
  | "ops.requests.v1"
  | "ops.kafka.metrics.v1"
  | "ops.incidents.v1"
  | "ops.actions.audit.v1"
  | "ops.lessons.v1"
  | "ops.notifications.v1";

export interface KafkaRecord<T = unknown> {
  topic: TopicName;
  partition: number;
  offset: number;
  key: string;
  timestamp: number;
  headers: Record<string, string>;
  value: T;
}

export interface AgentDefinition {
  id: AgentId;
  name: string;
  role: string;
  description: string;
  /** Topics this agent reads from. */
  consumes: TopicName[];
  /** Topics this agent publishes to. */
  produces: TopicName[];
  /** MCP tool names this agent exposes. */
  tools: string[];
  /** Position on the React Flow canvas. */
  position: { x: number; y: number };
  /** Subtitle shown on the node. */
  subtitle: string;
  /** Tailwind accent class for the node. */
  accent: "cyan" | "violet" | "emerald" | "amber" | "rose";
}

export interface AgentRuntimeState {
  status: AgentStatus;
  consumerLag: Record<string, number>;
  committedOffsets: Record<string, number>;
  inflight: number;
  processed: number;
  /** True between kill() and restart(). */
  killed: boolean;
  /** Last "reasoning" output (for Monitor agent). */
  lastReasoning?: ReasoningOutput;
  /** Last action result. */
  lastAction?: ActionResult;
  startedAt: number;
}

/* ------------------------------------------------------------------ */
/* Monitor -> Reason -> Act -> Learn                                  */
/* ------------------------------------------------------------------ */

export interface MetricsSignal {
  brokerId: number;
  topic: string;
  partition: number;
  consumerGroup: string;
  lagMessages: number;
  isrCount: number;
  rebalanceState:
    | "stable"
    | "preparing-rebalance"
    | "completing-rebalance"
    | "share-group-assigning";
  controllerEpoch: number;
  jvmHeapPercent: number;
  podCpuPercent: number;
  /** Indicates which Kafka 4.x KIP this signal exercises. */
  kafkaFeature: "KRaft" | "KIP-848" | "KIP-932" | "classic";
  noteForOperators?: string;
}

export interface ReasoningInput {
  signal: MetricsSignal;
  /** Last few entries from ops.lessons.v1 — seeds the prompt. */
  recentLessons: LessonRecord[];
}

export interface ReasoningOutput {
  rootCause: string;
  confidence: number; // 0..1
  recommendedAction:
    | "scale-consumers"
    | "rebalance-wait"
    | "controller-failover-ack"
    | "share-group-rebalance-ack"
    | "noop";
  rationale: string;
  requiresApproval: boolean;
  proposedToolCall: McpToolCall;
  /** Which Kafka 4.x feature was relevant. */
  kafkaFeatureCited: "KRaft" | "KIP-848" | "KIP-932" | "classic";
}

export interface ActionResult {
  toolCall: McpToolCall;
  approved: boolean;
  approvedBy?: string;
  executedAt: number;
  outcome: "success" | "noop" | "rejected" | "failed";
  detail: string;
  lagBefore?: number;
  lagAfter?: number;
}

export interface LessonRecord {
  id: string;
  ts: number;
  scenario: string;
  actionTaken: string;
  effective: boolean;
  lagBefore: number;
  lagAfter: number;
  adjustedThreshold?: number;
  notes: string;
}

/* ------------------------------------------------------------------ */
/* MCP                                                                */
/* ------------------------------------------------------------------ */

export interface McpToolDefinition {
  name: string;
  /** Owning agent that hosts this tool. */
  owner: AgentId;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  /** When true, calling this tool requires a policy approval gate. */
  requiresApproval: boolean;
  /** Free-form security tags rendered in the inspector. */
  policyTags: string[];
}

export interface McpToolCall {
  jsonrpc: "2.0";
  id: string;
  method: "tools/call";
  params: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface ApprovalRequest {
  id: string;
  createdAt: number;
  toolCall: McpToolCall;
  reason: string;
  proposedBy: AgentId;
  riskLevel: "low" | "medium" | "high";
  status: "pending" | "approved" | "rejected" | "expired";
  decidedAt?: number;
  decidedBy?: string;
}

/* ------------------------------------------------------------------ */
/* Incidents / audit                                                  */
/* ------------------------------------------------------------------ */

export interface IncidentEvent {
  id: string;
  ts: number;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  summary: string;
  signal: MetricsSignal;
  reasoning: ReasoningOutput;
  action?: ActionResult;
}

export interface AuditEvent {
  id: string;
  ts: number;
  agent: AgentId;
  kind:
    | "tool-call"
    | "approval-decision"
    | "publish"
    | "consume"
    | "commit-offset"
    | "agent-kill"
    | "agent-restart"
    | "replay-start"
    | "replay-complete";
  detail: string;
  meta?: Record<string, unknown>;
}

export interface NotificationEvent {
  id: string;
  ts: number;
  channel: "slack" | "itsm" | "email";
  title: string;
  body: string;
  link?: string;
}

/* ------------------------------------------------------------------ */
/* SSE wire format                                                    */
/* ------------------------------------------------------------------ */

export type WireEvent =
  | { kind: "snapshot"; payload: SnapshotPayload }
  | { kind: "topic-record"; payload: KafkaRecord<unknown> }
  | { kind: "agent-state"; payload: { agent: AgentId; state: AgentRuntimeState } }
  | { kind: "approval-new"; payload: ApprovalRequest }
  | { kind: "approval-update"; payload: ApprovalRequest }
  | { kind: "incident"; payload: IncidentEvent }
  | { kind: "audit"; payload: AuditEvent }
  | { kind: "notification"; payload: NotificationEvent }
  | { kind: "lesson"; payload: LessonRecord }
  | { kind: "particle"; payload: ParticleHint }
  | { kind: "log"; payload: { ts: number; agent: AgentId | "system"; level: "info" | "warn" | "error"; message: string } };

/** Tells the canvas to fly an animated particle along an edge. */
export interface ParticleHint {
  id: string;
  source: AgentId;
  target: AgentId;
  topic: TopicName;
  color: "cyan" | "violet" | "emerald" | "amber" | "rose" | "red";
  durationMs: number;
}

export interface SnapshotPayload {
  agents: Record<AgentId, AgentRuntimeState>;
  approvals: ApprovalRequest[];
  incidents: IncidentEvent[];
  audit: AuditEvent[];
  notifications: NotificationEvent[];
  lessons: LessonRecord[];
  topics: Record<
    TopicName,
    { partitions: number; logEndOffset: number; recentRecords: KafkaRecord[] }
  >;
  cluster: ClusterStatus;
}

export interface ClusterStatus {
  mode: "KRaft";
  controllerId: number;
  controllerEpoch: number;
  brokers: { id: number; rack: string; status: "online" | "offline" }[];
  schemaRegistry: { connected: boolean; specs: number };
  security: {
    mTLS: boolean;
    saslScram: boolean;
    aclsActive: number;
  };
}
