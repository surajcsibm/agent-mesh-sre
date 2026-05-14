"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2, RefreshCw, ArrowRight } from "lucide-react";

type ConnectInfo = {
  ok: boolean;
  connected?: boolean;
  context?: string;
  user?: string;
  serverUrl?: string;
  inCluster?: boolean;
  strimzi?: { present: boolean; version?: string };
  hint?: string;
  error?: string;
};

export function StepConnect({ onContinue }: { onContinue: () => void }) {
  const [info, setInfo] = useState<ConnectInfo | null>(null);
  const [loading, setLoading] = useState(false);

  async function probe(force = false) {
    setLoading(true);
    try {
      const r = await fetch("/api/cluster/connect", { method: force ? "POST" : "GET", cache: "no-store" });
      const j = (await r.json()) as ConnectInfo;
      setInfo(j);
    } catch (e) {
      setInfo({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { probe(); }, []);

  const okConnected = info?.connected === true;
  const okStrimzi = info?.strimzi?.present === true;

  return (
    <div className="space-y-4">
      <Card>
        <CardRow
          status={okConnected ? "ok" : info ? "error" : "loading"}
          title={okConnected ? "Kubernetes API reachable" : "Kubernetes API unreachable"}
          detail={
            okConnected
              ? `${info?.inCluster ? "in-cluster ServiceAccount" : "kubeconfig"} · context: ${info?.context} · user: ${info?.user ?? "n/a"} · ${info?.serverUrl ?? ""}`
              : info?.error || "Probing..."
          }
        />
        <CardRow
          status={okStrimzi ? "ok" : info ? "error" : "loading"}
          title={
            okStrimzi
              ? `Strimzi operator detected${info?.strimzi?.version ? ` (v${info.strimzi.version})` : ""}`
              : "Strimzi CRDs not found"
          }
          detail={
            okStrimzi
              ? "kafkas.kafka.strimzi.io CRD present \u2014 ready to apply manifests"
              : "Install Strimzi 0.51.0 from OperatorHub, then refresh."
          }
        />
      </Card>

      {!info?.ok && info?.hint && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[12.5px] text-amber-100/90">
          <div className="font-medium mb-1 text-amber-200">Next step</div>
          <div className="text-amber-100/80 leading-relaxed">{info.hint}</div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => probe(true)}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-md text-[12.5px] font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-fg-base disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>
        <button
          type="button"
          disabled={!okConnected || !okStrimzi}
          onClick={onContinue}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          style={{
            background: okConnected && okStrimzi
              ? "linear-gradient(135deg, rgba(34, 211, 238, 0.25), rgba(167, 139, 250, 0.25))"
              : "rgba(255,255,255,0.04)",
            border: `1px solid ${okConnected && okStrimzi ? "rgba(167,139,250,0.45)" : "rgba(255,255,255,0.1)"}`,
            color: okConnected && okStrimzi ? "#fff" : "var(--color-fg-dim)",
          }}
        >
          Continue
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-white/10 bg-bg-elev/40 divide-y divide-white/5">{children}</div>;
}

function CardRow({
  status,
  title,
  detail,
}: {
  status: "loading" | "ok" | "error";
  title: string;
  detail: string;
}) {
  const color = status === "ok" ? "#34d399" : status === "error" ? "#ef4444" : "#a78bfa";
  const Icon = status === "ok" ? CheckCircle2 : status === "error" ? AlertTriangle : Loader2;
  return (
    <div className="px-4 py-3.5 flex gap-3 items-start">
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}1f`, border: `1px solid ${color}40`, color }}
      >
        <Icon size={14} className={status === "loading" ? "animate-spin" : ""} />
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-fg-base">{title}</div>
        <div className="text-[11.5px] text-fg-muted font-mono mt-0.5 break-all">{detail}</div>
      </div>
    </div>
  );
}
