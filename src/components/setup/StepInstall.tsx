"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2, Hourglass, ArrowRight } from "lucide-react";
import { ORDERED_STEPS, StepEvent, StepState, WizardStep } from "./wizard-types";

type CredsView = {
  bootstrapInternal?: string;
  bootstrapExternal?: string;
  username?: string;
  hasPassword: boolean;
  hasCaCert: boolean;
};

export function StepInstall({
  onDone,
}: {
  onDone: (creds: CredsView | null) => void;
}) {
  const [steps, setSteps] = useState<StepState[]>(
    ORDERED_STEPS.map((s) => ({ step: s, phase: "pending" as const }))
  );
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [creds, setCreds] = useState<CredsView | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const ctrl = new AbortController();
    (async () => {
      try {
        const r = await fetch("/api/cluster/install", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
          signal: ctrl.signal,
        });
        if (!r.body) throw new Error("no response body");
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 2);
            if (!chunk.startsWith("data:")) continue;
            const json = chunk.replace(/^data:\s*/, "");
            try {
              const ev = JSON.parse(json) as StepEvent;
              applyEvent(ev);
            } catch {
              /* ignore malformed */
            }
          }
        }
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => ctrl.abort();
  }, []);

  function applyEvent(ev: StepEvent) {
    if (ev.kind === "step") {
      setSteps((prev) =>
        prev.map((s) => {
          if (s.step.id !== ev.step.id) return s;
          if (ev.phase === "applying") {
            return { ...s, phase: "applying", startedAt: ev.startedAt };
          }
          if (ev.phase === "applied") {
            return {
              ...s,
              phase: "applied",
              applyResults: ev.applyResults,
              finishedAt: Date.now(),
            };
          }
          if (ev.phase === "waiting") {
            return { ...s, phase: "waiting", startedAt: ev.startedAt };
          }
          if (ev.phase === "ready") {
            return { ...s, phase: "ready", finishedAt: Date.now(), message: ev.message };
          }
          if (ev.phase === "error") {
            return { ...s, phase: "error", finishedAt: Date.now(), message: ev.message };
          }
          return s;
        })
      );
    } else if (ev.kind === "credentials") {
      setCreds(ev.credentials);
    } else if (ev.kind === "done") {
      setDone(true);
    } else if (ev.kind === "error") {
      setError(ev.error);
    }
  }

  return (
    <div className="space-y-3">
      <ol className="rounded-xl border border-white/10 bg-bg-elev/40 divide-y divide-white/5">
        {steps.map((s, i) => (
          <Row key={s.step.id} state={s} index={i} />
        ))}
      </ol>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-[12.5px] text-red-200">
          {error}
        </div>
      )}

      {creds && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-[12.5px]">
          <div className="font-semibold text-emerald-200 mb-1.5">Credentials extracted</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-fg-base font-mono text-[11.5px]">
            <Field k="External bootstrap" v={creds.bootstrapExternal ?? "—"} />
            <Field k="Internal bootstrap" v={creds.bootstrapInternal ?? "—"} />
            <Field k="Username" v={creds.username ?? "—"} />
            <Field k="CA cert" v={creds.hasCaCert ? "loaded" : "missing"} />
            <Field k="Password" v={creds.hasPassword ? "loaded" : "missing"} />
          </div>
        </div>
      )}

      <div className="flex items-center pt-2">
        <button
          type="button"
          disabled={!done && !error}
          onClick={() => onDone(creds)}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{
            background: "linear-gradient(135deg, rgba(52, 211, 153, 0.25), rgba(34, 211, 238, 0.25))",
            border: "1px solid rgba(52,211,153,0.45)",
            color: "#fff",
            boxShadow: done ? "0 0 24px rgba(52,211,153,0.3)" : undefined,
          }}
        >
          {done ? "Continue" : error ? "Continue (with errors)" : "Installing..."}
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function Row({ state, index }: { state: StepState; index: number }) {
  const phase = state.phase;
  const c = phase === "ready" || phase === "applied"
    ? "#34d399"
    : phase === "error"
      ? "#ef4444"
      : phase === "applying" || phase === "waiting"
        ? "#a78bfa"
        : "#6b7280";
  const Icon =
    phase === "ready" || phase === "applied" ? CheckCircle2
    : phase === "error" ? AlertTriangle
    : phase === "applying" ? Loader2
    : phase === "waiting" ? Hourglass
    : Hourglass;
  const label =
    phase === "applied" ? "Applied"
    : phase === "ready" ? "Ready"
    : phase === "applying" ? "Applying..."
    : phase === "waiting" ? "Waiting..."
    : phase === "error" ? "Error"
    : "Pending";
  const dt = state.startedAt && state.finishedAt
    ? `${((state.finishedAt - state.startedAt) / 1000).toFixed(1)}s`
    : null;

  return (
    <li className="px-4 py-3.5 flex gap-3 items-start">
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${c}1f`, border: `1px solid ${c}40`, color: c }}
      >
        <Icon size={13} className={phase === "applying" || phase === "waiting" ? "animate-spin" : ""} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-wider text-fg-dim">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-[13px] font-medium text-fg-base">{state.step.description}</span>
          {state.step.file && (
            <span className="text-[10.5px] font-mono text-fg-dim">{state.step.file}</span>
          )}
          <span
            className="ml-auto text-[10.5px] font-mono uppercase tracking-wider"
            style={{ color: c }}
          >
            {label} {dt && <span className="text-fg-dim ml-1">{dt}</span>}
          </span>
        </div>
        {state.applyResults && state.applyResults.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {state.applyResults.map((r, i) => (
              <span
                key={i}
                className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                style={{
                  background: r.action === "error" ? "#ef444422" : "rgba(255,255,255,0.04)",
                  color: r.action === "error" ? "#fca5a5" : "var(--color-fg-muted)",
                  border: `1px solid ${r.action === "error" ? "#ef444444" : "rgba(255,255,255,0.08)"}`,
                }}
                title={r.message}
              >
                {r.kind}/{r.name} · {r.action}
              </span>
            ))}
          </div>
        )}
        {state.message && (
          <div className="mt-1 text-[11.5px] font-mono break-all" style={{ color: c }}>
            {state.message}
          </div>
        )}
      </div>
    </li>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 px-2 py-1 rounded bg-white/5">
      <span className="text-fg-dim">{k}</span>
      <span className="text-fg-base truncate" title={v}>{v}</span>
    </div>
  );
}
