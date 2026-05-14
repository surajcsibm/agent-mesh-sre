"use client";

import { useMesh } from "@/lib/store";
import { postJson } from "@/lib/sse-client";
import { cn, relTime } from "@/lib/utils";
import { AGENTS } from "@/lib/agents-config";
import { Check, ShieldAlert, X } from "lucide-react";
import { JsonPretty } from "../ui/JsonPretty";

export function ApprovalQueue() {
  const approvals = useMesh((s) => s.approvals);
  const pending = approvals.filter((a) => a.status === "pending");
  const past = approvals.filter((a) => a.status !== "pending").slice(-5);

  async function decide(id: string, decision: "approved" | "rejected") {
    await postJson("/api/approvals", { id, decision, actor: "vp-engineering@stage" });
  }

  return (
    <div className="flex flex-col h-full">
      <SectionHeader
        icon={<ShieldAlert size={13} className="text-amber-300" />}
        title="Policy approval gates"
        subtitle="Every infra-mutating MCP tool call routes through here. Human-in-the-loop, audit-ready."
      />

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {pending.length === 0 && past.length === 0 && (
          <div className="text-[12px] text-fg-dim italic px-2 py-6 text-center">
            No approvals yet. Run a scenario that triggers a policy-gated tool call.
          </div>
        )}

        {pending.map((a) => (
          <div key={a.id} className="rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3 animate-pulse-once">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="text-[12px] font-semibold text-amber-200">PENDING — requires approval</div>
              <div className="text-[10px] font-mono text-fg-dim">{relTime(a.createdAt)}</div>
            </div>
            <div className="text-[11.5px] text-fg-muted mb-2">
              Proposed by{" "}
              <span className="text-fg-base">{AGENTS[a.proposedBy]?.name ?? a.proposedBy}</span>
              {" — "}
              {a.reason}
            </div>
            <JsonPretty value={a.toolCall} />
            <div className="flex gap-2 mt-2.5">
              <button onClick={() => decide(a.id, "approved")} className="btn btn-success flex-1 justify-center">
                <Check size={13} /> Approve
              </button>
              <button onClick={() => decide(a.id, "rejected")} className="btn btn-danger flex-1 justify-center">
                <X size={13} /> Reject
              </button>
            </div>
          </div>
        ))}

        {past.map((a) => (
          <div key={a.id} className="rounded-lg border border-white/10 bg-bg-elev p-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span
                className={cn(
                  "tag",
                  a.status === "approved" ? "!text-emerald-300 !border-emerald-500/40" : "!text-rose-300 !border-rose-500/40"
                )}
              >
                {a.status.toUpperCase()}
              </span>
              <span className="text-fg-dim font-mono text-[10px]">{relTime(a.decidedAt ?? a.createdAt)}</span>
            </div>
            <div className="text-[11px] text-fg-muted mt-1.5 truncate">
              {a.toolCall.params.name}
              {a.decidedBy && <span className="text-fg-dim"> · {a.decidedBy}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="px-3 py-2.5 border-b border-white/10">
      <div className="flex items-center gap-1.5">
        {icon}
        <div className="text-[11px] font-mono uppercase tracking-wider text-fg-base">{title}</div>
      </div>
      {subtitle && <div className="text-[11px] text-fg-muted mt-1">{subtitle}</div>}
    </div>
  );
}
