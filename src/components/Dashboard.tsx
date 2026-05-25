"use client";

import dynamic from "next/dynamic";
import { useMeshStream } from "./useMeshStream";
import type { ApprovalRequest, AuditRecord } from "@/lib/types";
import clsx from "clsx";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

const AgentCanvas = dynamic(() => import("./AgentCanvas"), { ssr: false });

// ── Scenario definitions ──────────────────────────────────────────────────────

const SCENARIOS = [
  { id: "lag-spike",           label: "Consumer Lag Spike",         badge: "KIP-848", color: "#2563eb" },
  { id: "controller-failover", label: "KRaft Controller Failover",  badge: "KRaft",   color: "#7c3aed" },
  { id: "share-group",         label: "Share Group Rebalance",      badge: "KIP-932", color: "#ea580c" },
  { id: "benign-rebalance",    label: "False-Positive Suppression", badge: "KIP-848", color: "#16a34a" },
] as const;

// ── Semantic colour maps ──────────────────────────────────────────────────────

const AUDIT_COLOR: Record<string, string> = {
  publish:          "#2563eb",
  consume:          "#16a34a",
  reasoning:        "#7c3aed",
  "tool-call":      "#ea580c",
  approval:         "#d97706",
  lesson:           "#0891b2",
  notification:     "#db2777",
  "agent-kill":     "#dc2626",
  "agent-restart":  "#16a34a",
  "replay-start":   "#0891b2",
  "replay-complete":"#16a34a",
};

const MRAL_LABELS: Record<string, string> = {
  idle: "IDLE", monitor: "MONITOR", reason: "REASON",
  awaiting: "AWAITING", act: "ACT", learn: "LEARN", replaying: "REPLAYING",
};

const MRAL_BG: Record<string, string> = {
  idle:      "bg-slate-100  text-slate-500  border-slate-300",
  monitor:   "bg-blue-50    text-blue-700   border-blue-200",
  reason:    "bg-violet-50  text-violet-700 border-violet-200",
  awaiting:  "bg-amber-50   text-amber-700  border-amber-200",
  act:       "bg-orange-50  text-orange-700 border-orange-200",
  learn:     "bg-green-50   text-green-700  border-green-200",
  replaying: "bg-cyan-50    text-cyan-700   border-cyan-200",
};

const MRAL_DOT: Record<string, string> = {
  idle: "#94a3b8", monitor: "#2563eb", reason: "#7c3aed",
  awaiting: "#d97706", act: "#ea580c", learn: "#16a34a", replaying: "#0891b2",
};

// ── Toast stack ───────────────────────────────────────────────────────────────

function ToastStack({ toasts }: { toasts: { id: number; message: string; kind: string }[] }) {
  const styles: Record<string, string> = {
    info:    "bg-blue-50   border-blue-200   text-blue-800",
    success: "bg-green-50  border-green-200  text-green-800",
    warning: "bg-amber-50  border-amber-200  text-amber-800",
    error:   "bg-red-50    border-red-200    text-red-700",
  };
  const icons: Record<string, string> = { info: "ℹ", success: "✓", warning: "⚠", error: "✕" };
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div key={t.id}
          className={clsx("flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg border",
            styles[t.kind] ?? styles.info)}>
          <span className="text-xs font-bold">{icons[t.kind] ?? "ℹ"}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ── Approval gate ─────────────────────────────────────────────────────────────

function ApprovalGate({ approvals, onDecide }: {
  approvals: ApprovalRequest[];
  onDecide: (id: string, d: "approve" | "reject") => void;
}) {
  if (!approvals.length) return null;
  return (
    <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-amber-200 rounded-2xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-lg">🔐</div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Policy Gate</h2>
            <p className="text-xs text-amber-600 font-medium">Approval required before action</p>
          </div>
        </div>
        {approvals.map((a) => (
          <div key={a.id} className="mb-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex gap-4 mb-3 text-xs">
              <span className="text-slate-500">Scenario: <span className="text-slate-800 font-semibold">{a.scenarioId}</span></span>
              <span className="text-slate-500">Agent: <span className="text-slate-800 font-semibold">{a.agent}</span></span>
            </div>
            <pre className="text-xs font-mono bg-white rounded-lg border border-slate-200 p-3 mb-4 overflow-x-auto text-slate-700 leading-relaxed">
              {JSON.stringify(a.toolCall.params, null, 2)}
            </pre>
            <div className="flex gap-3">
              <button onClick={() => onDecide(a.id, "approve")}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600
                           text-white font-semibold text-sm transition-colors shadow-sm">
                ✓ Approve
              </button>
              <button onClick={() => onDecide(a.id, "reject")}
                className="flex-1 py-2.5 rounded-xl bg-red-100 hover:bg-red-200
                           text-red-700 font-semibold text-sm transition-colors border border-red-200">
                ✕ Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── User menu ─────────────────────────────────────────────────────────────────

function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  if (!session?.user) return null;

  const name     = session.user.name  ?? "User";
  const email    = session.user.email ?? "";
  const image    = session.user.image;
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-blue-200 bg-white pl-1.5 pr-3 py-1
                   hover:border-blue-400 hover:bg-blue-50 transition-colors shadow-sm">
        {image
          ? <img src={image} alt={name} referrerPolicy="no-referrer" className="w-6 h-6 rounded-full" />
          : <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[9px] font-bold text-white">
              {initials}
            </div>
        }
        <span className="text-xs text-slate-700 font-medium max-w-[100px] truncate hidden sm:block">{name}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-slate-200 bg-white shadow-xl z-50">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="text-xs font-semibold text-slate-800 truncate">{name}</div>
            <div className="text-[10px] text-slate-400 truncate">{email}</div>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full text-left px-4 py-2.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-b-xl transition-colors">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// ── Audit log panel ───────────────────────────────────────────────────────────

function AuditLogPanel({ log }: { log: AuditRecord[] }) {
  return (
    <div className="flex flex-col h-full">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
        Audit Log <span className="text-slate-300 font-normal normal-case">({log.length})</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
        {[...log].reverse().map((r) => (
          <div key={r.id} className="flex gap-2 items-start text-[10px] leading-snug py-0.5">
            <span className="shrink-0 font-bold uppercase w-14 text-right"
              style={{ color: AUDIT_COLOR[r.type] ?? "#94a3b8" }}>
              {r.type.slice(0, 7)}
            </span>
            <span className="text-slate-600 truncate">[{r.agent}] {r.summary}</span>
          </div>
        ))}
        {log.length === 0 && (
          <p className="text-[11px] text-slate-400 italic px-1 pt-2">No events yet — trigger a scenario.</p>
        )}
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { state, trigger, approve, agentAction, reset } = useMeshStream();
  const phase = state.mralPhase ?? "idle";

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* ── Nav bar — professional deep blue ── */}
      <nav className="bg-blue-800 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center text-white font-bold text-sm border border-white/20">
            ⚡
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight">Agent Mesh SRE</div>
            <div className="text-[10px] text-blue-200 font-medium">Monitor · Reason · Act · Learn</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* MRAL global phase */}
          <div className={clsx(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 border text-xs font-bold",
            MRAL_BG[phase] ?? MRAL_BG.idle
          )}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: MRAL_DOT[phase] }} />
            {MRAL_LABELS[phase] ?? "IDLE"}
          </div>

          {/* Connection status */}
          <div className={clsx("flex items-center gap-1.5 rounded-full px-3 py-1.5 border text-xs font-semibold",
            state.connected
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700")}>
            <div className={clsx("w-1.5 h-1.5 rounded-full",
              state.connected ? "animate-pulse bg-green-500" : "bg-red-500")} />
            {state.connected ? "Live" : "Reconnecting…"}
          </div>

          {/* Kafka mode */}
          {state.broker && (
            <div className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-3 py-1.5">
              {state.broker.mode} mode
            </div>
          )}

          <button onClick={reset}
            className="text-xs text-white/80 hover:text-white border border-white/20 hover:border-white/40
                       bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition-colors">
            ↺ Reset
          </button>

          <UserMenu />
        </div>
      </nav>

      {/* ── Main layout ── */}
      <div className="flex flex-1 gap-0 overflow-hidden">

        {/* Left sidebar */}
        <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col gap-5 p-4 overflow-y-auto shadow-sm">

          {/* Scenarios */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
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
                             bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50
                             shadow-sm group"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-800 leading-tight">
                      {s.label}
                    </span>
                    <span className="text-[9px] font-bold shrink-0 px-1.5 py-0.5 rounded-md"
                      style={{ background: s.color + "15", color: s.color, border: `1px solid ${s.color}30` }}>
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
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                Broker
              </div>
              <div className="space-y-1.5 bg-slate-50 rounded-xl p-3 border border-slate-200">
                {Object.entries(state.broker.topics).map(([topic, t]) => (
                  <div key={topic} className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-slate-500 truncate">{topic.split(".").pop()}</span>
                    <span className={clsx("text-[9px] font-bold",
                      (t as { lag: number }).lag > 0 ? "text-amber-600" : "text-slate-400")}>
                      lag {(t as { lag: number }).lag.toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="border-t border-slate-200 mt-2 pt-2 space-y-1">
                  {Object.entries(state.broker.consumerGroups).map(([group, g]) => (
                    <div key={group} className="flex items-center justify-between">
                      <span className="text-[9px] text-slate-500 truncate">{group}</span>
                      <span className={clsx("text-[9px] font-bold",
                        (g as { lag: number }).lag > 5000 ? "text-red-600" :
                        (g as { lag: number }).lag > 0   ? "text-amber-600" : "text-emerald-600")}>
                        {(g as { lag: number }).lag.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Incident queue — warning yellow */}
          {state.incidentQueueDepth > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="text-xs font-bold text-amber-700 mb-1">⚠ Incident Queue</div>
              <div className="text-2xl font-black text-amber-600">{state.incidentQueueDepth}</div>
              <div className="text-[10px] text-amber-500">pending on ops.incidents.v1</div>
            </div>
          )}
        </aside>

        {/* Canvas */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          <div className="flex-1 p-4 min-h-0">
            <AgentCanvas
              agents={state.agents}
              broker={state.broker}
              activeParticles={state.particles}
              onKill={(id) => agentAction(id, "kill")}
              onRestart={(id) => agentAction(id, "restart")}
            />
          </div>

          {/* Notifications strip — light green */}
          {state.notifications.length > 0 && (
            <div className="shrink-0 border-t border-green-100 bg-green-50 px-4 py-2">
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                {[...state.notifications].reverse().slice(0, 5).map((n) => (
                  <div key={n.id}
                    className="shrink-0 flex items-center gap-2 bg-white border border-green-200
                               rounded-lg px-3 py-1.5 text-xs shadow-sm">
                    <span>{n.channel === "slack" ? "💬" : n.channel === "itsm" ? "🎫" : "✉️"}</span>
                    <span className="text-green-800 font-medium max-w-[260px] truncate">{n.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Right sidebar — audit log + lessons */}
        <aside className="w-72 shrink-0 bg-white border-l border-slate-200 flex flex-col p-4 overflow-hidden shadow-sm">
          <div className="flex-1 overflow-hidden">
            <AuditLogPanel log={state.auditLog} />
          </div>

          {/* Lessons learned — light cyan */}
          {state.lessons.length > 0 && (
            <div className="shrink-0 mt-4 border-t border-slate-200 pt-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Lessons Learned ({state.lessons.length})
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {[...state.lessons].reverse().slice(0, 5).map((l) => (
                  <div key={l.id}
                    className="text-[10px] bg-cyan-50 rounded-lg px-2.5 py-2 border border-cyan-100">
                    <div className="text-cyan-700 font-semibold truncate">[{l.scenarioId}] {l.actionTaken}</div>
                    <div className="text-slate-500 truncate mt-0.5">{l.notes.slice(0, 60)}…</div>
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
