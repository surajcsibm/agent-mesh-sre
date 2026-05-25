"use client";

import dynamic from "next/dynamic";
import { useMeshStream } from "./useMeshStream";
import type { ApprovalRequest, AuditRecord } from "@/lib/types";
import clsx from "clsx";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

// AgentCanvas uses ReactFlow which is client-only
const AgentCanvas = dynamic(() => import("./AgentCanvas"), { ssr: false });

// ── Scenario definitions ──────────────────────────────────────────────────────

const SCENARIOS = [
  { id: "lag-spike",           label: "Consumer Lag Spike",        badge: "KIP-848",  color: "#3b82f6" },
  { id: "controller-failover", label: "KRaft Controller Failover", badge: "KRaft",    color: "#8b5cf6" },
  { id: "share-group",         label: "Share Group Rebalance",     badge: "KIP-932",  color: "#f97316" },
  { id: "benign-rebalance",    label: "False-Positive Suppression", badge: "KIP-848", color: "#22c55e" },
] as const;

// ── Audit type colours ────────────────────────────────────────────────────────

const AUDIT_COLOR: Record<string, string> = {
  publish:         "#3b82f6",
  consume:         "#22c55e",
  reasoning:       "#a78bfa",
  "tool-call":     "#f97316",
  approval:        "#eab308",
  lesson:          "#06b6d4",
  notification:    "#ec4899",
  "agent-kill":    "#ef4444",
  "agent-restart": "#22c55e",
  "replay-start":  "#06b6d4",
  "replay-complete":"#22c55e",
};

const MRAL_LABELS: Record<string, string> = {
  idle: "IDLE", monitor: "MONITOR", reason: "REASON",
  awaiting: "AWAITING", act: "ACT", learn: "LEARN", replaying: "REPLAYING",
};

const MRAL_COLORS: Record<string, string> = {
  idle: "#475569", monitor: "#3b82f6", reason: "#8b5cf6",
  awaiting: "#eab308", act: "#f97316", learn: "#22c55e", replaying: "#06b6d4",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ToastStack({ toasts }: { toasts: { id: number; message: string; kind: string }[] }) {
  const bg: Record<string, string> = { info: "bg-slate-800", success: "bg-emerald-900", warning: "bg-amber-900", error: "bg-red-900" };
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div key={t.id} className={clsx("rounded-xl px-4 py-3 text-sm font-medium shadow-xl border border-white/10", bg[t.kind] ?? bg.info)}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

function ApprovalGate({ approvals, onDecide }: { approvals: ApprovalRequest[]; onDecide: (id: string, d: "approve" | "reject") => void }) {
  if (!approvals.length) return null;
  return (
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-amber-500/50 rounded-2xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🔐</span>
          <h2 className="text-lg font-bold text-amber-400">Policy Gate — Approval Required</h2>
        </div>
        {approvals.map((a) => (
          <div key={a.id} className="mb-4 bg-slate-900/60 rounded-xl p-4 border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">Scenario: <span className="text-slate-200 font-semibold">{a.scenarioId}</span></div>
            <div className="text-xs text-slate-400 mb-2">Agent: <span className="text-slate-200 font-semibold">{a.agent}</span></div>
            <div className="text-sm text-slate-200 font-mono bg-slate-950/60 rounded p-3 mb-4 text-xs leading-relaxed break-all">
              {JSON.stringify(a.toolCall.params, null, 2)}
            </div>
            <div className="flex gap-3">
              <button onClick={() => onDecide(a.id, "approve")}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500
                           text-white font-bold text-sm transition-colors shadow-sm">
                ✓ Approve
              </button>
              <button onClick={() => onDecide(a.id, "reject")}
                className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-600
                           text-white font-bold text-sm transition-colors shadow-sm">
                ✕ Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── User menu (Google OAuth) ──────────────────────────────────────────────────

function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  if (!session?.user) return null;

  const name  = session.user.name  ?? "User";
  const email = session.user.email ?? "";
  const image = session.user.image;
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 pl-1.5 pr-3 py-1 hover:border-slate-500 transition-colors">
        {image
          ? <img src={image} alt={name} referrerPolicy="no-referrer"
              className="w-6 h-6 rounded-full" />
          : <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-[9px] font-bold text-white">
              {initials}
            </div>
        }
        <span className="text-xs text-slate-300 max-w-[100px] truncate hidden sm:block">{name}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-slate-700 bg-slate-900 shadow-xl z-50">
          <div className="px-4 py-3 border-b border-slate-800">
            <div className="text-xs font-semibold text-white truncate">{name}</div>
            <div className="text-[10px] text-slate-500 truncate">{email}</div>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white rounded-b-xl transition-colors">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function AuditLogPanel({ log }: { log: AuditRecord[] }) {
  return (
    <div className="flex flex-col h-full">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
        Audit Log <span className="text-slate-600 font-normal normal-case">({log.length})</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
        {[...log].reverse().map((r) => (
          <div key={r.id} className="flex gap-2 text-[10px] leading-snug">
            <span className="shrink-0 font-bold uppercase"
              style={{ color: AUDIT_COLOR[r.type] ?? "#94a3b8" }}>
              {r.type.slice(0, 7)}
            </span>
            <span className="text-slate-300 truncate">[{r.agent}] {r.summary}</span>
          </div>
        ))}
        {log.length === 0 && <p className="text-[11px] text-slate-600 italic">No events yet — trigger a scenario.</p>}
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { state, trigger, approve, agentAction, reset } = useMeshStream();

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col">
      {/* ── Nav ── */}
      <nav className="bg-slate-900/80 border-b border-slate-700/50 backdrop-blur-sm
                      px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            ⚡
          </div>
          <div>
            <div className="text-sm font-bold text-white">Agent Mesh SRE</div>
            <div className="text-[10px] text-slate-500">Monitor · Reason · Act · Learn</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* MRAL global phase */}
          <div className="flex items-center gap-1.5 bg-slate-800 rounded-full px-3 py-1.5 border border-slate-700">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: MRAL_COLORS[state.mralPhase] }} />
            <span className="text-xs font-bold" style={{ color: MRAL_COLORS[state.mralPhase] }}>
              {MRAL_LABELS[state.mralPhase] ?? "IDLE"}
            </span>
          </div>

          {/* Connection badge */}
          <div className={clsx("flex items-center gap-1.5 rounded-full px-3 py-1.5 border text-xs font-semibold",
            state.connected
              ? "bg-emerald-950 border-emerald-700 text-emerald-400"
              : "bg-red-950 border-red-700 text-red-400")}>
            <div className={clsx("w-1.5 h-1.5 rounded-full", state.connected ? "animate-pulse bg-emerald-400" : "bg-red-500")} />
            {state.connected ? "Live" : "Reconnecting…"}
          </div>

          {/* Kafka mode */}
          {state.broker && (
            <div className="text-xs font-bold text-blue-400 bg-blue-950/50 border border-blue-800/50 rounded-full px-3 py-1.5">
              {state.broker.mode} mode
            </div>
          )}

          <button onClick={reset}
            className="text-xs text-slate-400 hover:text-white border border-slate-700
                       hover:border-slate-500 rounded-lg px-3 py-1.5 transition-colors">
            ↺ Reset
          </button>

          <UserMenu />
        </div>
      </nav>

      {/* ── Main content ── */}
      <div className="flex flex-1 gap-0 overflow-hidden">

        {/* Left sidebar — scenarios + broker stats */}
        <aside className="w-64 shrink-0 bg-slate-900/40 border-r border-slate-800/50
                          flex flex-col gap-4 p-4 overflow-y-auto">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
              Scenarios
            </div>
            <div className="space-y-2">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  disabled={state.scenarioRunning}
                  onClick={() => trigger(s.id)}
                  className="w-full text-left rounded-xl p-3 border transition-all
                             disabled:opacity-40 disabled:cursor-not-allowed
                             bg-slate-800/60 border-slate-700/50
                             hover:border-blue-600/50 hover:bg-slate-700/60 group"
                >
                  <div className="flex items-start justify-between gap-1.5 mb-0.5">
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight">
                      {s.label}
                    </span>
                    <span className="text-[9px] font-bold shrink-0 px-1.5 py-0.5 rounded"
                      style={{ background: s.color + "25", color: s.color, border: `1px solid ${s.color}40` }}>
                      {s.badge}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Broker panel */}
          {state.broker && (
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                Broker
              </div>
              <div className="space-y-1.5 bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                {Object.entries(state.broker.topics).map(([topic, t]) => (
                  <div key={topic} className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-slate-500 truncate">{topic.split(".").pop()}</span>
                    <span className={clsx("text-[9px] font-bold",
                      (t as { lag: number }).lag > 0 ? "text-amber-400" : "text-slate-500")}>
                      lag {(t as { lag: number }).lag.toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="border-t border-slate-700/50 mt-2 pt-2 space-y-1">
                  {Object.entries(state.broker.consumerGroups).map(([group, g]) => (
                    <div key={group} className="flex items-center justify-between">
                      <span className="text-[9px] text-slate-500 truncate">{group}</span>
                      <span className={clsx("text-[9px] font-bold",
                        (g as { lag: number }).lag > 5000 ? "text-red-400" :
                        (g as { lag: number }).lag > 0   ? "text-amber-400" : "text-emerald-400")}>
                        {(g as { lag: number }).lag.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Incident queue */}
          {state.incidentQueueDepth > 0 && (
            <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-3">
              <div className="text-xs font-bold text-amber-400 mb-1">⚠ Incident Queue</div>
              <div className="text-2xl font-black text-amber-300">{state.incidentQueueDepth}</div>
              <div className="text-[10px] text-amber-600">pending on ops.incidents.v1</div>
            </div>
          )}
        </aside>

        {/* Canvas */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 p-4 min-h-0">
            <AgentCanvas
              agents={state.agents}
              broker={state.broker}
              activeParticles={state.particles}
              onKill={(id) => agentAction(id, "kill")}
              onRestart={(id) => agentAction(id, "restart")}
            />
          </div>

          {/* Notifications strip */}
          {state.notifications.length > 0 && (
            <div className="shrink-0 border-t border-slate-800/50 bg-slate-900/50 px-4 py-2">
              <div className="flex gap-3 overflow-x-auto pb-1">
                {[...state.notifications].reverse().slice(0, 5).map((n) => (
                  <div key={n.id}
                    className="shrink-0 flex items-center gap-2 bg-slate-800/60 border border-slate-700/50
                               rounded-lg px-3 py-1.5 text-xs">
                    <span>{n.channel === "slack" ? "💬" : n.channel === "itsm" ? "🎫" : "✉️"}</span>
                    <span className="text-slate-300 max-w-[260px] truncate">{n.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Right sidebar — audit log + lessons */}
        <aside className="w-72 shrink-0 bg-slate-900/40 border-l border-slate-800/50
                          flex flex-col p-4 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <AuditLogPanel log={state.auditLog} />
          </div>

          {/* Lessons */}
          {state.lessons.length > 0 && (
            <div className="shrink-0 mt-4 border-t border-slate-800/50 pt-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                Lessons Learned ({state.lessons.length})
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {[...state.lessons].reverse().slice(0, 5).map((l) => (
                  <div key={l.id} className="text-[10px] bg-slate-800/50 rounded-lg px-2 py-1.5 border border-slate-700/50">
                    <div className="text-cyan-400 font-semibold truncate">[{l.scenarioId}] {l.actionTaken}</div>
                    <div className="text-slate-400 truncate">{l.notes.slice(0, 60)}…</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Overlays */}
      <ApprovalGate approvals={state.pendingApprovals} onDecide={approve} />
      <ToastStack toasts={state.toasts} />
    </div>
  );
}
