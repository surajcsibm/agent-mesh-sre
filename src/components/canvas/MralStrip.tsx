"use client";

/**
 * Live Monitor -> Reason -> Act -> Learn progress strip.
 * Reflects the Monitor agent's current status to make the proposal pattern
 * unmistakable to the audience.
 */
import { useMesh } from "@/lib/store";
import { Activity, Brain, Sparkles, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

type Stage = "monitor" | "reason" | "act" | "learn";

export function MralStrip() {
  const status = useMesh((s) => s.agents?.["monitor-agent"]?.status);
  const stage = mapStatus(status);
  const stages: { key: Stage; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "monitor", label: "Monitor", icon: <Activity size={11} />, color: "#22d3ee" },
    { key: "reason", label: "Reason", icon: <Brain size={11} />, color: "#a78bfa" },
    { key: "act", label: "Act", icon: <Wrench size={11} />, color: "#fbbf24" },
    { key: "learn", label: "Learn", icon: <Sparkles size={11} />, color: "#34d399" },
  ];
  const idx = stages.findIndex((s) => s.key === stage);

  return (
    <div className="glass rounded-lg px-3 py-2">
      <div className="text-[9.5px] uppercase tracking-wider font-mono text-fg-dim mb-1.5">
        Monitor agent loop
      </div>
      <div className="flex items-center gap-1">
        {stages.map((s, i) => {
          const active = i === idx;
          const done = idx > i;
          const future = idx < i;
          return (
            <div key={s.key} className="flex items-center gap-1">
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 transition-all",
                  active && "border",
                  done && "opacity-70"
                )}
                style={{
                  background: active ? `${s.color}1f` : done ? `${s.color}10` : "rgba(255,255,255,0.02)",
                  borderColor: active ? `${s.color}80` : "transparent",
                  color: future ? "var(--color-fg-dim)" : s.color,
                  boxShadow: active ? `0 0 14px ${s.color}40` : "none",
                }}
              >
                <span className={active ? "agent-pulse rounded-full" : ""}>{s.icon}</span>
                <span className="text-[10.5px] font-mono font-semibold uppercase tracking-wider">
                  {s.label}
                </span>
              </div>
              {i < stages.length - 1 && (
                <span
                  className="text-[10px]"
                  style={{ color: i < idx ? stages[i].color : "var(--color-fg-dim)" }}
                >
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function mapStatus(s?: string): Stage | undefined {
  switch (s) {
    case "online":
    case "starting":
      return "monitor";
    case "reasoning":
    case "awaiting-approval":
      return "reason";
    case "acting":
      return "act";
    case "learning":
      return "learn";
    default:
      return undefined;
  }
}
