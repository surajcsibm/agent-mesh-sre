"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { useMesh } from "@/lib/store";
import type { TopicName } from "@/lib/types";

interface TopicEdgeData {
  topic: TopicName;
  feature?: "KRaft" | "KIP-848" | "KIP-932" | "classic";
  audit?: boolean;
  partitions: number;
}

export function TopicEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected } = props;
  const ed = data as unknown as TopicEdgeData;
  const select = useMesh((s) => s.select);
  const topicState = useMesh((s) => s.topics?.[ed.topic]);
  const isAudit = ed.audit;
  const stroke = isAudit ? "#fbbf24" : selected ? "#a78bfa" : "rgba(180, 200, 240, 0.55)";

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.32,
  });

  const offset = topicState?.logEndOffset ?? 0;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{ stroke, strokeWidth: selected ? 2.4 : 1.8, opacity: 0.9 }}
        className="edge-flow"
        markerEnd={props.markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          className="absolute pointer-events-auto"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            select({ kind: "edge", topic: ed.topic });
          }}
        >
          <div
            className="glass rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-white/30 transition-colors"
            style={{ border: `1px solid ${selected ? "rgba(167, 139, 250, 0.7)" : "rgba(255, 255, 255, 0.12)"}` }}
          >
            <div className="flex items-center gap-2 text-[10.5px] font-mono">
              <span className="text-fg-base font-medium">{ed.topic}</span>
              <span className="text-fg-dim">·</span>
              <span className="text-fg-muted">{ed.partitions}p</span>
              <span className="text-fg-dim">·</span>
              <span className="text-fg-muted">offset {offset}</span>
            </div>
            {ed.feature && (
              <div className="text-[9px] mt-0.5 font-mono uppercase tracking-wider" style={{ color: featureColor(ed.feature) }}>
                {ed.feature}
              </div>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

function featureColor(f: string): string {
  switch (f) {
    case "KRaft": return "#22d3ee";
    case "KIP-848": return "#a78bfa";
    case "KIP-932": return "#fbbf24";
    default: return "#94a3b8";
  }
}
