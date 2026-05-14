"use client";

import Link from "next/link";
import { CheckCircle2, ArrowRight, Sparkles, Terminal, Zap } from "lucide-react";

export function StepDone({
  creds,
}: {
  creds: { bootstrapInternal?: string; bootstrapExternal?: string; username?: string; hasPassword: boolean; hasCaCert: boolean } | null;
}) {
  return (
    <div className="space-y-5">
      <div
        className="rounded-2xl p-6 text-center"
        style={{
          background: "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,211,238,0.18), rgba(167,139,250,0.18))",
          border: "1px solid rgba(34,197,94,0.4)",
          boxShadow: "0 0 60px rgba(34,197,94,0.18)",
        }}
      >
        <div className="inline-flex w-14 h-14 rounded-full items-center justify-center mb-3" style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.5)" }}>
          <CheckCircle2 size={26} className="text-emerald-300" />
        </div>
        <div className="text-[19px] font-semibold text-fg-base">Cluster ready. Demo is live.</div>
        <div className="text-[13px] text-fg-muted mt-1.5 max-w-lg mx-auto leading-relaxed">
          The agents now produce and consume from <strong>real Kafka topics</strong> on Strimzi. Scenario buttons mutate the real cluster.
        </div>
      </div>

      {creds && (
        <div className="rounded-xl border border-white/10 bg-bg-elev/40 p-5">
          <div className="text-[12.5px] uppercase tracking-wider font-mono text-fg-dim mb-2.5 flex items-center gap-1.5">
            <Sparkles size={12} className="text-violet-400" />
            Connection
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px] font-mono">
            <KV k="External bootstrap" v={creds.bootstrapExternal ?? "—"} />
            <KV k="Internal bootstrap" v={creds.bootstrapInternal ?? "—"} />
            <KV k="Username" v={creds.username ?? "—"} />
            <KV k="CA cert" v={creds.hasCaCert ? "loaded into runtime" : "missing"} />
            <KV k="SCRAM password" v={creds.hasPassword ? "loaded into runtime" : "missing"} />
            <KV k="Mode" v="real" highlight />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link
          href="/"
          className="rounded-xl border border-emerald-500/40 p-4 hover:bg-emerald-500/10 transition-colors group"
          style={{ background: "linear-gradient(135deg, rgba(34,211,238,0.12), rgba(34,197,94,0.12))" }}
        >
          <div className="flex items-center gap-2.5 mb-1">
            <Zap size={15} className="text-emerald-300" />
            <div className="text-[14px] font-semibold text-fg-base">Open the live demo</div>
            <ArrowRight size={14} className="ml-auto text-fg-dim group-hover:text-fg-base transition-colors" />
          </div>
          <div className="text-[11.5px] text-fg-muted leading-relaxed">
            Run scenarios against the real cluster. Click an agent to inspect its real-time reasoning.
          </div>
        </Link>

        <Link
          href="/builder"
          className="rounded-xl border border-violet-500/30 p-4 hover:bg-violet-500/10 transition-colors group"
          style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.12), rgba(34,211,238,0.10))" }}
        >
          <div className="flex items-center gap-2.5 mb-1">
            <Terminal size={15} className="text-violet-300" />
            <div className="text-[14px] font-semibold text-fg-base">Open the workflow builder</div>
            <ArrowRight size={14} className="ml-auto text-fg-dim group-hover:text-fg-base transition-colors" />
          </div>
          <div className="text-[11.5px] text-fg-muted leading-relaxed">
            Drag agents onto a canvas, draw arrows to wire Kafka topics, deploy a custom agent mesh.
          </div>
        </Link>
      </div>
    </div>
  );
}

function KV({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-3 px-2.5 py-1.5 rounded bg-white/5 border border-white/5">
      <span className="text-fg-dim">{k}</span>
      <span className={highlight ? "text-emerald-300 font-semibold" : "text-fg-base truncate"} title={v}>{v}</span>
    </div>
  );
}
