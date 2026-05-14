"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { useBuilder, type BuilderTopic } from "@/lib/builder-store";
import { useBuilderRuntime } from "@/lib/builder-runtime";
import { useMemo } from "react";

type Data = { topic: BuilderTopic };

export function BuilderEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected } = props;
  const select = useBuilder((s) => s.select);
  const t = (data as Data | undefined)?.topic;
  const topicId = t?.id;

  // particles flowing along this edge while the runtime is running
  // Use primitive selectors to avoid infinite loops
  const allParticles = useBuilderRuntime((s) => s.particles);
  const particles = useMemo(
    () => (topicId ? allParticles.filter((p) => p.edgeId === topicId) : []),
    [topicId, allParticles]
  );
  
  const edgeStats = useBuilderRuntime((s) => s.edgeStats);
  const stat = topicId ? edgeStats[topicId] : undefined;

  const compact = t?.cleanupPolicy?.includes("compact");
  const audit = !!t?.topic?.includes("audit");
  const stroke = audit ? "#fbbf24" : compact ? "#a78bfa" : "rgba(180, 200, 240, 0.7)";

  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke,
          strokeWidth: selected ? 2.5 : 1.6,
          strokeDasharray: compact ? "5 4" : "0",
          opacity: selected ? 1 : 0.85,
          filter: selected ? `drop-shadow(0 0 6px ${stroke})` : undefined,
        }}
      />

      {/* animated particles along the bezier path */}
      {particles.map((p) => {
        const elapsed = Date.now() - p.startedAt;
        const progress = Math.max(0, Math.min(1, elapsed / p.durationMs));
        return (
          <circle
            key={p.id}
            r={3.5}
            fill={stroke}
            style={{ filter: `drop-shadow(0 0 6px ${stroke})` }}
          >
            <animateMotion
              dur={`${p.durationMs}ms`}
              fill="freeze"
              begin={`${-elapsed}ms`}
              keyTimes="0;1"
              keyPoints={`${progress};1`}
              calcMode="linear"
              path={path}
            />
          </circle>
        );
      })}

      <EdgeLabelRenderer>
        <div
          className="absolute pointer-events-auto cursor-pointer"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          onClick={(e) => {
            e.stopPropagation();
            if (t) select({ kind: "topic", id: t.id });
          }}
        >
          <div
            className="rounded-md px-2 py-0.5 text-[10.5px] font-mono whitespace-nowrap transition-all"
            style={{
              background: `${stroke}1a`,
              border: `1px solid ${stroke}55`,
              color: "var(--color-fg-base)",
              boxShadow: selected ? `0 0 12px ${stroke}55` : undefined,
            }}
          >
            <span className="text-fg-base font-semibold">{t?.topic ?? "untitled.topic"}</span>
            {t && (
              <span className="ml-1.5 text-fg-dim">
                · p{t.partitions} · {t.cleanupPolicy === "compact" ? "compact" : t.cleanupPolicy === "compact,delete" ? "c+d" : "delete"}
              </span>
            )}
            {stat && stat.emitted > 0 && (
              <span
                className="ml-1.5 px-1 rounded text-[9.5px] font-bold"
                style={{ background: `${stroke}33`, color: "var(--color-fg-base)" }}
              >
                {stat.emitted}
              </span>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
