"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CircuitBoard,
  Layers,
  Play,
  Power,
  RefreshCw,
  RotateCw,
  Server,
  Trash2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { postJson } from "@/lib/sse-client";
import { AGENT_ORDER, AGENTS } from "@/lib/agents-config";
import { useMesh } from "@/lib/store";
import { useClusterStore } from "@/lib/cluster-status";
import { useToasts } from "@/lib/toasts";
import { cn } from "@/lib/utils";
import type { AgentId } from "@/lib/types";

type ScenarioKey = "lag-spike" | "controller-failover" | "share-group-rebalance" | "partition-imbalance";

const SCENARIOS: { key: ScenarioKey; title: string; subtitle: string; icon: LucideIcon; color: string; tag: string }[] = [
  {
    key: "lag-spike",
    title: "Consumer lag spike",
    subtitle: "Sustained backlog on payments-consumer. Monitor cross-checks rebalance state, proposes N→N+2 scale.",
    icon: Activity,
    color: "#a78bfa",
    tag: "KIP-848",
  },
  {
    key: "controller-failover",
    title: "KRaft controller failover",
    subtitle: "Leadership change → epoch++. Healthy event; agent acks without paging.",
    icon: CircuitBoard,
    color: "#22d3ee",
    tag: "KRaft",
  },
  {
    key: "share-group-rebalance",
    title: "Share group rebalance",
    subtitle: "KIP-932 share-group offsets diverge. Reasoner uses share-group telemetry, not classic CG thresholds.",
    icon: Layers,
    color: "#fbbf24",
    tag: "KIP-932",
  },
  {
    key: "partition-imbalance",
    title: "Benign rebalance (suppress page)",
    subtitle: "Lag rises during a healthy KIP-848 cooperative rebalance. Agent suppresses the false-positive — exactly where static scripts would page.",
    icon: AlertTriangle,
    color: "#34d399",
    tag: "KIP-848",
  },
];

type ScenarioStep = {
  description: string;
  command?: string;
  status: "running" | "ok" | "error";
  message?: string;
  startedAt?: number;
  finishedAt?: number;
};
type ScenarioApiResponse = {
  ok: boolean;
  mode: "mock" | "real";
  sim?: { ok: boolean };
  real?: { kind: string; ranAt: string; ok: boolean; steps: ScenarioStep[] } | null;
  realError?: string;
  warning?: string;
};

export function ScenarioPanel() {
  const [busy, setBusy] = useState<string | null>(null);
  const mode = useClusterStore((s) => s.mode?.mode ?? "mock");
  const isReal = mode === "real";
  const push = useToasts((s) => s.push);

  async function run(s: typeof SCENARIOS[number]) {
    setBusy(s.key);
    const tid = push({
      title: isReal ? `Dispatching to real cluster: ${s.title}` : `Running scenario: ${s.title}`,
      subtitle: isReal ? "Mutating Strimzi-managed workloads…" : "Driving in-process simulator…",
      tone: "info",
      ttlMs: 0,
    });
    try {
      const res = (await postJson("/api/scenario", { kind: s.key })) as ScenarioApiResponse;
      const realSteps = (res.real?.steps ?? []).map((x) => ({
        description: x.description,
        command: x.command,
        status: x.status,
        message: x.message,
        durationMs: x.startedAt && x.finishedAt ? x.finishedAt - x.startedAt : undefined,
      }));
      const tone = res.realError
        ? "error"
        : isReal
          ? res.real?.ok
            ? "ok"
            : "warn"
          : "ok";
      const subtitle = res.realError
        ? `Real-cluster dispatch failed: ${res.realError}. Simulator still ran.`
        : isReal
          ? `Mode: real · ${realSteps.length} step${realSteps.length === 1 ? "" : "s"} on ${"agent-mesh-sre"} namespace`
          : "Simulator scenario completed.";
      useToasts.getState().update(tid, {
        title: `${isReal ? "Real cluster" : "Simulator"} · ${s.title}`,
        subtitle,
        tone,
        steps: realSteps.length ? realSteps : undefined,
        ttlMs: tone === "ok" ? 6000 : 0,
      });
      // Re-arm timer for the autodismiss after update
      if (tone === "ok") setTimeout(() => useToasts.getState().dismiss(tid), 6000);
    } catch (e) {
      useToasts.getState().update(tid, {
        title: `${s.title} failed`,
        subtitle: e instanceof Error ? e.message : String(e),
        tone: "error",
        ttlMs: 0,
      });
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    setBusy("reset");
    const tid = push({
      title: "Resetting mesh",
      subtitle: isReal ? "Restoring demo workloads + clearing simulator state" : "Clearing simulator state",
      tone: "info",
      ttlMs: 0,
    });
    try {
      await postJson("/api/reset", {});
      useToasts.getState().update(tid, {
        title: "Reset complete",
        subtitle: "Topics cleared, agents re-armed.",
        tone: "ok",
        ttlMs: 4000,
      });
      setTimeout(() => useToasts.getState().dismiss(tid), 4000);
    } catch (e) {
      useToasts.getState().update(tid, {
        title: "Reset failed",
        subtitle: e instanceof Error ? e.message : String(e),
        tone: "error",
        ttlMs: 0,
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2 px-0.5">
          <div className="text-[10.5px] uppercase tracking-wider font-mono text-fg-dim">Run a scenario</div>
          <ModeChip isReal={isReal} />
        </div>
        <div className="space-y-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              disabled={busy !== null}
              onClick={() => run(s)}
              className="w-full text-left rounded-lg border border-white/10 bg-bg-elev hover:border-white/25 transition-colors p-3 disabled:opacity-60"
              style={{ background: `linear-gradient(180deg, ${s.color}10, transparent)` }}
            >
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${s.color}1f`, border: `1px solid ${s.color}40` }}>
                  <s.icon size={15} className="" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-[12.5px] font-semibold text-fg-base">{s.title}</div>
                    <span className="tag" style={{ color: s.color, borderColor: `${s.color}55` }}>{s.tag}</span>
                    {isReal && (
                      <span
                        className="tag flex items-center gap-1"
                        style={{ color: "#34d399", borderColor: "#34d39955", background: "#34d39910" }}
                        title="Will mutate the real Strimzi-managed cluster"
                      >
                        <Server size={9} /> real
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-fg-muted leading-snug mt-1">{s.subtitle}</div>
                </div>
                <div className="shrink-0 flex items-center text-fg-dim">
                  {busy === s.key ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <AgentLifecycle />

      <div className="pt-3 border-t border-white/10">
        <button
          onClick={reset}
          disabled={busy !== null}
          className="btn btn-danger w-full justify-center"
        >
          <Trash2 size={13} />
          Reset mesh state
        </button>
      </div>
    </div>
  );
}

function ModeChip({ isReal }: { isReal: boolean }) {
  const c = isReal ? "#34d399" : "#a78bfa";
  return (
    <span
      className="text-[9.5px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded flex items-center gap-1"
      style={{ background: `${c}15`, border: `1px solid ${c}40`, color: c }}
      title={isReal ? "Scenarios will mutate the live Strimzi-managed cluster" : "Scenarios drive the in-process simulator only"}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
      {isReal ? "real cluster" : "simulator"}
    </span>
  );
}

function AgentLifecycle() {
  const agents = useMesh((s) => s.agents);
  const [busy, setBusy] = useState<AgentId | null>(null);

  async function toggle(id: AgentId, op: "kill" | "restart") {
    setBusy(id);
    try {
      await postJson("/api/agent", { id, op });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-3">
      <div className="flex items-center gap-2 mb-2">
        <Zap size={13} className="text-amber-300" />
        <div className="text-[11px] uppercase tracking-wider font-mono text-amber-200">The replay moment</div>
      </div>
      <div className="text-[11.5px] text-fg-muted leading-snug mb-2.5">
        Kill the <span className="text-fg-base font-medium">Writer Agent</span> mid-flow. Events accumulate on{" "}
        <code>ops.incidents.v1</code>. Restart it — replay from the last committed offset, in front of the audience.
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {AGENT_ORDER.filter((id) => id !== "intake-agent").map((id) => {
          const def = AGENTS[id];
          const state = agents?.[id];
          const isCrashed = state?.status === "crashed";
          return (
            <div key={id} className="flex items-center justify-between rounded-lg border border-white/10 bg-bg-elev px-2.5 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn("dot", isCrashed ? "crit" : state?.status === "replaying" ? "warn" : "live")} />
                <span className="text-[11.5px] font-medium truncate">{def.name}</span>
              </div>
              <div className="flex items-center gap-1">
                {!isCrashed ? (
                  <button
                    disabled={busy === id}
                    onClick={() => toggle(id, "kill")}
                    className="btn btn-danger !py-1 !px-2 !text-[10.5px]"
                    title="Kill agent (simulate crash)"
                  >
                    <Power size={11} />
                    Kill
                  </button>
                ) : (
                  <button
                    disabled={busy === id}
                    onClick={() => toggle(id, "restart")}
                    className="btn btn-success !py-1 !px-2 !text-[10.5px]"
                    title="Restart and replay from last committed offset"
                  >
                    <RotateCw size={11} />
                    Restart & replay
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
