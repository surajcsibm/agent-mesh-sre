"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, Loader2, X, Terminal } from "lucide-react";
import { useToasts, type Toast } from "@/lib/toasts";

const TONE_COLOR: Record<Toast["tone"], string> = {
  ok: "#34d399",
  warn: "#fbbf24",
  error: "#ef4444",
  info: "#a78bfa",
};

const TONE_ICON: Record<Toast["tone"], typeof Info> = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  error: AlertTriangle,
  info: Info,
};

/** Bottom-right stacked toast container. Use anywhere by mounting once. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[420px] max-w-[92vw] pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToasts((s) => s.dismiss);
  const [open, setOpen] = useState(false);
  const [enter, setEnter] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setEnter(true), 10);
    return () => clearTimeout(t);
  }, []);

  const c = TONE_COLOR[toast.tone];
  const Icon = TONE_ICON[toast.tone];
  const hasSteps = toast.steps && toast.steps.length > 0;

  return (
    <div
      className="pointer-events-auto rounded-xl border bg-bg-elev/90 backdrop-blur-md p-3 shadow-2xl transition-all"
      style={{
        borderColor: `${c}44`,
        boxShadow: `0 12px 40px ${c}22`,
        transform: enter ? "translateY(0)" : "translateY(8px)",
        opacity: enter ? 1 : 0,
      }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: `${c}1f`, border: `1px solid ${c}40`, color: c }}
        >
          <Icon size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold text-fg-base">{toast.title}</div>
          {toast.subtitle && (
            <div className="text-[11px] text-fg-muted leading-relaxed mt-0.5">{toast.subtitle}</div>
          )}
          {hasSteps && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-1.5 text-[10.5px] font-mono uppercase tracking-wider text-fg-dim hover:text-fg-base flex items-center gap-1"
            >
              <Terminal size={10} />
              {open ? "Hide" : "Show"} {toast.steps!.length} step{toast.steps!.length === 1 ? "" : "s"}
            </button>
          )}
          {hasSteps && open && (
            <ol className="mt-2 space-y-1.5 max-h-48 overflow-auto pr-1">
              {toast.steps!.map((s, i) => (
                <li key={i} className="rounded-md bg-white/5 border border-white/10 px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <StepDot status={s.status} />
                    <span className="text-[11px] text-fg-base font-medium flex-1 truncate">{s.description}</span>
                    {s.durationMs != null && (
                      <span className="text-[9.5px] font-mono text-fg-dim">{(s.durationMs / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                  {s.command && (
                    <code className="block mt-1 text-[10.5px] font-mono text-cyan-200 break-all">{s.command}</code>
                  )}
                  {s.message && (
                    <div className="mt-0.5 text-[10.5px] font-mono text-rose-200/90 break-all">{s.message}</div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
        <button
          type="button"
          onClick={() => dismiss(toast.id)}
          className="text-fg-dim hover:text-fg-base p-1 -m-1 rounded transition-colors"
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

function StepDot({ status }: { status: "running" | "ok" | "error" }) {
  if (status === "running") return <Loader2 size={11} className="animate-spin text-violet-300" />;
  if (status === "ok") return <CheckCircle2 size={11} className="text-emerald-300" />;
  return <AlertTriangle size={11} className="text-rose-300" />;
}
