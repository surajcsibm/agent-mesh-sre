"use client";

import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Bot, Network, Sparkles, Trash2, Wrench } from "lucide-react";
import { useBuilder, type BuilderAgent } from "@/lib/builder-store";
import { cn } from "@/lib/utils";

const ACCENT_TO_RGB: Record<string, string> = {
  cyan: "34, 211, 238",
  violet: "167, 139, 250",
  emerald: "52, 211, 153",
  amber: "251, 191, 36",
  rose: "251, 113, 133",
};

type Data = { agent: BuilderAgent };

function BuilderNodeImpl({ data, selected }: NodeProps) {
  const { agent } = data as Data;
  const rgb = ACCENT_TO_RGB[agent.accent];
  const select = useBuilder((s) => s.select);
  const remove = useBuilder((s) => s.removeAgent);

  // Use primitive selector and compute derived values with useMemo
  const topics = useBuilder((s) => s.design.topics);
  const consumes = useMemo(() => topics.filter((t) => t.target === agent.id).length, [topics, agent.id]);
  const produces = useMemo(() => topics.filter((t) => t.source === agent.id).length, [topics, agent.id]);

  return (
    <div className="relative group" onClick={() => select({ kind: "agent", id: agent.id })}>
      <Handle type="target" position={Position.Left} style={{ background: `rgba(${rgb}, 0.9)`, width: 10, height: 10 }} />

      <div
        className={cn(
          "w-[240px] rounded-2xl border bg-bg-elev p-3.5 transition-all",
          "shadow-[0_8px_28px_rgba(0,0,0,0.5)]",
          selected ? "ring-2 ring-offset-0" : "border-white/10 hover:border-white/25"
        )}
        style={{
          background: `linear-gradient(165deg, rgba(${rgb}, 0.10) 0%, rgba(20, 24, 38, 0.95) 60%)`,
          boxShadow: selected
            ? `0 0 0 2px rgba(${rgb}, 0.55), 0 0 28px rgba(${rgb}, 0.22), 0 12px 32px rgba(0,0,0,0.5)`
            : `0 0 0 1px rgba(${rgb}, 0.18), 0 12px 32px rgba(0,0,0,0.4)`,
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `rgba(${rgb}, 0.2)`, border: `1px solid rgba(${rgb}, 0.4)` }}
            >
              <Bot size={15} style={{ color: `rgb(${rgb})` }} />
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-[12.5px] font-semibold text-fg-base truncate">{agent.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-fg-dim font-mono">{agent.role}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              remove(agent.id);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-fg-dim hover:text-rose-300 p-1 rounded"
            title="Delete node"
          >
            <Trash2 size={12} />
          </button>
        </div>
        <div className="text-[11px] text-fg-muted leading-snug mb-2 min-h-[28px] line-clamp-2">{agent.description || "No description"}</div>

        <div className="flex items-center gap-3 text-[10px] font-mono text-fg-dim">
          <span className="flex items-center gap-1">
            <Wrench size={10} /> {agent.tools.length}
          </span>
          <span className="flex items-center gap-1">
            <Network size={10} /> {consumes}↓ {produces}↑
          </span>
          {agent.role === "monitor" && (
            <span className="flex items-center gap-1 ml-auto" style={{ color: `rgb(${rgb})` }}>
              <Sparkles size={10} /> M-R-A-L
            </span>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Right} style={{ background: `rgba(${rgb}, 0.9)`, width: 10, height: 10 }} />
      <Handle id="self-out" type="source" position={Position.Top} style={{ background: `rgba(${rgb}, 0.6)`, width: 8, height: 8, left: "70%" }} />
      <Handle id="self-in" type="target" position={Position.Top} style={{ background: `rgba(${rgb}, 0.6)`, width: 8, height: 8, left: "30%" }} />
    </div>
  );
}

export const BuilderNode = memo(BuilderNodeImpl);
