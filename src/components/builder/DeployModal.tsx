"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileCode2,
  Layers,
  Lock,
  Pause,
  Play,
  ShieldCheck,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useBuilder, type BuilderDesign } from "@/lib/builder-store";
import { useBuilderRuntime } from "@/lib/builder-runtime";
import { useClusterStore } from "@/lib/cluster-status";
import {
  buildAsyncAPI,
  buildTopicYaml,
  buildUserYaml,
  slug,
  validateDesign,
  type ValidationResult,
} from "@/lib/builder-codegen";

type Tab = "summary" | "asyncapi" | "kafka-topic" | "kafka-user" | "json";

export function DeployModal({ onClose }: { onClose: () => void }) {
  const design = useBuilder((s) => s.design);
  const [tab, setTab] = useState<Tab>("summary");

  const validation = useMemo(() => validateDesign(design), [design]);
  const asyncapi = useMemo(() => buildAsyncAPI(design), [design]);
  const topicYaml = useMemo(() => buildTopicYaml(design), [design]);
  const userYaml = useMemo(() => buildUserYaml(design), [design]);
  const json = useMemo(() => JSON.stringify(design, null, 2), [design]);

  const tabs: { id: Tab; label: string; icon: typeof FileCode2 }[] = [
    { id: "summary", label: "Summary", icon: ShieldCheck },
    { id: "asyncapi", label: "AsyncAPI", icon: FileCode2 },
    { id: "kafka-topic", label: "KafkaTopic CRs", icon: Layers },
    { id: "kafka-user", label: "KafkaUser CRs", icon: Lock },
    { id: "json", label: "Design JSON", icon: FileCode2 },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div
        className="rounded-2xl bg-bg-elev border border-white/10 w-[1100px] max-w-full h-[80vh] flex flex-col overflow-hidden"
        style={{ boxShadow: "0 30px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(167,139,250,0.18)" }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(34,211,238,0.25), rgba(167,139,250,0.25))", border: "1px solid rgba(167,139,250,0.4)" }}
            >
              <Zap size={16} className="text-violet-300" />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-fg-base">Deploy preview — {design.name}</div>
              <div className="text-[10.5px] uppercase tracking-wider font-mono text-fg-dim">{design.agents.length} agents · {design.topics.length} topics</div>
            </div>
          </div>
          <button onClick={onClose} className="text-fg-dim hover:text-fg-base p-1.5 rounded-md hover:bg-white/5">
            <X size={15} />
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-white/10 px-3 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 px-3 py-2 text-[12px] border-b-2 transition-colors whitespace-nowrap"
                style={{
                  borderColor: active ? "rgb(167,139,250)" : "transparent",
                  color: active ? "var(--color-fg-base)" : "var(--color-fg-dim)",
                }}
              >
                <Icon size={12} /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-auto">
          {tab === "summary" && <Summary validation={validation} design={design} onClose={onClose} />}
          {tab === "asyncapi" && <CodeView code={asyncapi} filename="asyncapi.yaml" lang="yaml" />}
          {tab === "kafka-topic" && <CodeView code={topicYaml} filename="kafka-topics.yaml" lang="yaml" />}
          {tab === "kafka-user" && <CodeView code={userYaml} filename="kafka-users.yaml" lang="yaml" />}
          {tab === "json" && <CodeView code={json} filename={`${slug(design.name)}.json`} lang="json" />}
        </div>
      </div>
    </div>
  );
}

function Summary({
  validation,
  design,
  onClose,
}: {
  validation: ValidationResult;
  design: BuilderDesign;
  onClose: () => void;
}) {
  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">
      <div
        className="rounded-2xl p-5"
        style={{
          background: validation.ok
            ? "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,211,238,0.10))"
            : "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,113,133,0.10))",
          border: validation.ok ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(251,191,36,0.4)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: validation.ok ? "rgba(34,197,94,0.2)" : "rgba(251,191,36,0.2)" }}
          >
            {validation.ok ? <Check size={16} className="text-emerald-300" /> : <ShieldCheck size={16} className="text-amber-200" />}
          </div>
          <div>
            <div className="text-[14px] font-semibold text-fg-base">{validation.ok ? "Design is valid" : `${validation.warnings.length} warning${validation.warnings.length === 1 ? "" : "s"}`}</div>
            <div className="text-[11.5px] text-fg-muted">
              {validation.ok ? "Ready to deploy as Strimzi KafkaTopic + KafkaUser CRs." : "Review the warnings below — deploy anyway is supported."}
            </div>
          </div>
        </div>
        {validation.warnings.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {validation.warnings.map((w, i) => (
              <li key={i} className="text-[11.5px] text-amber-100/90 flex gap-2">
                <span className="text-amber-300">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <RunOnCanvasCard design={design} onClose={onClose} />
        <ApplyToClusterCard design={design} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card title="Agents" icon={<ShieldCheck size={13} className="text-violet-300" />}>
          <ul className="space-y-1.5">
            {design.agents.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-[11.5px]">
                <span className="text-fg-base font-medium truncate">{a.name}</span>
                <span className="text-fg-dim font-mono text-[10.5px]">{a.role}</span>
              </li>
            ))}
            {design.agents.length === 0 && <li className="text-fg-dim text-[11.5px]">no agents yet</li>}
          </ul>
        </Card>
        <Card title="Topics" icon={<Layers size={13} className="text-cyan-300" />}>
          <ul className="space-y-1.5">
            {design.topics.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-[11.5px]">
                <span className="text-fg-base font-mono text-[10.5px] truncate">{t.topic}</span>
                <span className="text-fg-dim font-mono text-[10px]">p{t.partitions} · {t.cleanupPolicy}</span>
              </li>
            ))}
            {design.topics.length === 0 && <li className="text-fg-dim text-[11.5px]">no topics yet</li>}
          </ul>
        </Card>
      </div>

      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-3.5 text-[11.5px] leading-relaxed">
        <div className="text-cyan-200 font-medium mb-1">What deploy does</div>
        <ul className="text-fg-muted list-disc list-inside space-y-0.5">
          <li><b className="text-fg-base">Run on canvas</b> animates synthetic Kafka traffic along your topic edges so you can preview the topology in motion. No server, no cluster, purely visual.</li>
          <li><b className="text-fg-base">Apply to cluster</b> creates the Strimzi <code>KafkaTopic</code> + <code>KafkaUser</code> CRs in <code>agent-mesh-sre</code> namespace via your local <code>kubeconfig</code>. Requires real mode.</li>
          <li>The other tabs preview the AsyncAPI 3.0 spec, the YAML CRs, and the design JSON for code review.</li>
        </ul>
      </div>
    </div>
  );
}

function RunOnCanvasCard({ design, onClose }: { design: BuilderDesign; onClose: () => void }) {
  const running = useBuilderRuntime((s) => s.running);
  const speed = useBuilderRuntime((s) => s.speed);
  const start = useBuilderRuntime((s) => s.start);
  const stop = useBuilderRuntime((s) => s.stop);
  const reset = useBuilderRuntime((s) => s.reset);
  const setSpeed = useBuilderRuntime((s) => s.setSpeed);

  const disabled = design.topics.length === 0;

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{
        background: running
          ? "linear-gradient(135deg, rgba(34,211,238,0.10), rgba(167,139,250,0.08))"
          : "rgba(255,255,255,0.02)",
        borderColor: running ? "rgba(34,211,238,0.45)" : "rgba(255,255,255,0.10)",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(34,211,238,0.18)", border: "1px solid rgba(34,211,238,0.35)" }}
        >
          <Play size={14} className="text-cyan-300" />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-fg-base">Run on canvas</div>
          <div className="text-[10.5px] uppercase tracking-wider font-mono text-fg-dim">
            client-side simulator
          </div>
        </div>
      </div>

      <p className="text-[11.5px] text-fg-muted leading-snug">
        Animates record particles along every topic edge so you can see the topology in motion.
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (running) {
              stop();
              return;
            }
            start(design);
            onClose();
          }}
          disabled={disabled}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={
            running
              ? {
                  background: "linear-gradient(135deg, rgba(34,211,238,0.28), rgba(167,139,250,0.22))",
                  border: "1px solid rgba(34,211,238,0.55)",
                  color: "#fff",
                }
              : {
                  background: "rgba(34,211,238,0.18)",
                  border: "1px solid rgba(34,211,238,0.4)",
                  color: "#fff",
                }
          }
        >
          {running ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Run on canvas</>}
        </button>
        {running && (
          <button
            type="button"
            onClick={reset}
            className="px-2.5 py-1.5 rounded-md text-[11.5px] bg-white/5 hover:bg-white/10 border border-white/10 text-fg-base transition-colors"
          >
            Reset counters
          </button>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between text-[10.5px] font-mono text-fg-dim mb-1">
          <span>Speed</span>
          <span className="text-fg-base">{speed.toFixed(1)} events/s</span>
        </div>
        <input
          type="range"
          min={0.5}
          max={12}
          step={0.5}
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="w-full accent-cyan-400"
        />
      </div>

      {disabled && (
        <div className="text-[10.5px] text-amber-200 flex gap-1.5">
          <AlertTriangle size={11} className="shrink-0 mt-0.5" /> Add at least one topic edge before running.
        </div>
      )}
    </div>
  );
}

type ApplyEvent =
  | { kind: "phase"; phase: "topics" | "users"; total: number }
  | { kind: "apply"; phase: "topics" | "users"; name: string; resourceKind: "KafkaTopic" | "KafkaUser"; status: "applying" | "applied" | "error"; message?: string }
  | { kind: "ready"; phase: "topics" | "users"; name: string; ready: boolean; message?: string }
  | { kind: "snapshot"; snapshot: unknown }
  | { kind: "done"; ok: true }
  | { kind: "error"; error: string };

type ApplyEntry = {
  name: string;
  resourceKind: "KafkaTopic" | "KafkaUser";
  status: "applying" | "applied" | "error" | "ready" | "not-ready";
  message?: string;
};

function ApplyToClusterCard({ design }: { design: BuilderDesign }) {
  const mode = useClusterStore((s: any) => s.mode?.mode ?? "mock");
  const isReal = mode === "real";

  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Record<string, ApplyEntry>>({});

  // refresh the cluster snapshot once the apply finishes so the topbar
  // chip ticks up its KafkaTopic / KafkaUser counts
  const refreshSnapshot = useClusterStore((s: any) => s.refreshSnapshot);
  useEffect(() => {
    if (done) refreshSnapshot();
  }, [done, refreshSnapshot]);

  async function apply() {
    setRunning(true);
    setDone(false);
    setError(null);
    setEntries({});

    let buffer = "";
    try {
      const res = await fetch("/api/cluster/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design, waitReady: true }),
      });
      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += dec.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const block of lines) {
          const line = block.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            const ev = JSON.parse(line.slice("data: ".length)) as ApplyEvent;
            handleEvent(ev);
          } catch {
            /* ignore malformed */
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  function handleEvent(ev: ApplyEvent) {
    if (ev.kind === "apply") {
      setEntries((prev) => ({
        ...prev,
        [ev.name]: {
          name: ev.name,
          resourceKind: ev.resourceKind,
          status: ev.status,
          message: ev.message,
        },
      }));
    } else if (ev.kind === "ready") {
      setEntries((prev) => {
        const e = prev[ev.name];
        if (!e) return prev;
        return {
          ...prev,
          [ev.name]: {
            ...e,
            status: ev.ready ? "ready" : "not-ready",
            message: ev.message ?? e.message,
          },
        };
      });
    } else if (ev.kind === "done") {
      setDone(true);
    } else if (ev.kind === "error") {
      setError(ev.error);
    }
  }

  const list = Object.values(entries);
  const counts = {
    topics: list.filter((e) => e.resourceKind === "KafkaTopic").length,
    users: list.filter((e) => e.resourceKind === "KafkaUser").length,
    ready: list.filter((e) => e.status === "ready").length,
    errors: list.filter((e) => e.status === "error" || e.status === "not-ready").length,
  };
  const disabled = !isReal || running || design.topics.length === 0;

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{
        background: done
          ? "linear-gradient(135deg, rgba(34,197,94,0.10), rgba(34,211,238,0.06))"
          : "rgba(255,255,255,0.02)",
        borderColor: done ? "rgba(34,197,94,0.45)" : "rgba(255,255,255,0.10)",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.35)" }}
        >
          <Upload size={14} className="text-emerald-300" />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-fg-base">Apply to cluster</div>
          <div className="text-[10.5px] uppercase tracking-wider font-mono text-fg-dim">
            {isReal ? "real cluster · live oc apply" : "mock mode · disabled"}
          </div>
        </div>
      </div>

      <p className="text-[11.5px] text-fg-muted leading-snug">
        Creates {design.topics.length} <code>KafkaTopic</code> and {design.agents.length} <code>KafkaUser</code> CRs in <code>agent-mesh-sre</code> via your local <code>kubeconfig</code>.
      </p>

      <button
        type="button"
        onClick={apply}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: "linear-gradient(135deg, rgba(34,197,94,0.28), rgba(34,211,238,0.22))",
          border: "1px solid rgba(34,197,94,0.55)",
          color: "#fff",
        }}
      >
        <Upload size={12} />
        {running ? "Applying…" : done ? "Apply again" : "Apply to cluster"}
      </button>

      {!isReal && (
        <div className="text-[10.5px] text-amber-200 flex gap-1.5">
          <AlertTriangle size={11} className="shrink-0 mt-0.5" />
          Connect a Kafka cluster from <code>/setup</code> to enable apply.
        </div>
      )}

      {(running || list.length > 0 || error) && (
        <div className="rounded-md border border-white/10 bg-black/20 p-2 max-h-48 overflow-auto space-y-1">
          {list.map((e) => (
            <div key={e.name} className="flex items-center gap-2 text-[10.5px] font-mono">
              <StatusDot status={e.status} />
              <span className="text-fg-dim">{e.resourceKind}/</span>
              <span className="text-fg-base truncate">{e.name}</span>
              {e.message && <span className="text-amber-300 truncate">— {e.message}</span>}
            </div>
          ))}
          {running && list.length === 0 && (
            <div className="text-[10.5px] font-mono text-fg-dim">connecting…</div>
          )}
          {error && (
            <div className="text-[10.5px] font-mono text-rose-300">! {error}</div>
          )}
          {done && (
            <div className="text-[10.5px] font-mono text-emerald-300 mt-1.5">
              ✓ done · {counts.ready}/{list.length} ready · {counts.topics} topics, {counts.users} users
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: ApplyEntry["status"] }) {
  const c =
    status === "ready" || status === "applied"
      ? "#34d399"
      : status === "error" || status === "not-ready"
      ? "#fb7185"
      : status === "applying"
      ? "#22d3ee"
      : "#a78bfa";
  return (
    <span
      className="inline-block w-2 h-2 rounded-full"
      style={{ background: c, boxShadow: `0 0 6px ${c}` }}
    />
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-bg-elev/40 p-3.5">
      <div className="flex items-center gap-1.5 mb-2 text-[10.5px] uppercase tracking-wider font-mono text-fg-dim">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function CodeView({ code, filename, lang }: { code: string; filename: string; lang: "yaml" | "json" }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function download() {
    const blob = new Blob([code], { type: lang === "json" ? "application/json" : "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 text-[11px]">
        <span className="font-mono text-fg-dim">{filename}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={copy}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10.5px] bg-white/5 hover:bg-white/10 border border-white/10 text-fg-base transition-colors"
          >
            {copied ? <Check size={11} className="text-emerald-300" /> : <Copy size={11} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={download}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10.5px] bg-white/5 hover:bg-white/10 border border-white/10 text-fg-base transition-colors"
          >
            <Download size={11} /> Download
          </button>
        </div>
      </div>
      <pre className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-fg-base whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

