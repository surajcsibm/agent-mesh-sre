"use client";

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background, Controls,
  Handle, Position,
} from "@xyflow/react";
import type { Node, Edge, NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { AgentState, MralPhase } from "@/lib/types";
import clsx from "clsx";

// ── Status colours ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  online:             "#22c55e",
  reasoning:          "#a78bfa",
  acting:             "#f97316",
  "awaiting-approval":"#eab308",
  crashed:            "#ef4444",
  replaying:          "#06b6d4",
  idle:               "#64748b",
};

const MRAL_COLOR: Record<MralPhase, string> = {
  idle:      "#475569",
  monitor:   "#3b82f6",
  reason:    "#8b5cf6",
  awaiting:  "#eab308",
  act:       "#f97316",
  learn:     "#22c55e",
  replaying: "#06b6d4",
};

// ── Custom AgentNode ──────────────────────────────────────────────────────────

interface AgentNodeData extends Record<string, unknown> {
  agent: AgentState;
  onKill: (id: string) => void;
  onRestart: (id: string) => void;
}

function AgentNode({ data }: NodeProps<Node<AgentNodeData>>) {
  const { agent, onKill, onRestart } = data as AgentNodeData;
  const statusColor = STATUS_COLOR[agent.status] ?? "#64748b";
  const mralColor   = MRAL_COLOR[agent.mralPhase] ?? "#475569";
  const crashed = agent.status === "crashed";

  return (
    <div
      className={clsx(
        "relative rounded-xl border-2 p-3 w-44 shadow-lg transition-all duration-300",
        crashed ? "bg-red-950/60 border-red-500/70" : "bg-slate-800/90 border-slate-600/60"
      )}
      style={{ borderColor: crashed ? "#ef4444" : agent.color + "80" }}
    >
      <Handle type="target" position={Position.Left}  style={{ background: "#475569", border: "none" }} />
      <Handle type="source" position={Position.Right} style={{ background: "#475569", border: "none" }} />

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse"
          style={{ background: statusColor }} />
        <div className="text-xs font-bold text-slate-100 truncate leading-tight">
          {agent.name}
        </div>
      </div>

      {/* MRAL phase badge */}
      <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 mb-2"
        style={{ background: mralColor + "22", border: `1px solid ${mralColor}55` }}>
        <span className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: mralColor }}>
          {agent.mralPhase}
        </span>
      </div>

      {/* Status */}
      <div className="text-[10px] text-slate-400 truncate mb-2">{agent.status}</div>

      {/* Last action snippet */}
      {agent.lastAction && (
        <div className="text-[9px] text-slate-500 truncate bg-slate-900/50 rounded px-1.5 py-0.5 mb-2">
          {agent.lastAction.detail.slice(0, 40)}…
        </div>
      )}

      {/* Kill / Restart buttons */}
      <div className="flex gap-1 mt-1">
        {!crashed ? (
          <button onClick={() => onKill(agent.id)}
            className="flex-1 text-[9px] font-semibold py-0.5 rounded bg-red-900/40
                       text-red-400 hover:bg-red-800/60 transition-colors border border-red-800/40">
            Kill
          </button>
        ) : (
          <button onClick={() => onRestart(agent.id)}
            className="flex-1 text-[9px] font-semibold py-0.5 rounded bg-cyan-900/40
                       text-cyan-400 hover:bg-cyan-800/60 transition-colors border border-cyan-800/40">
            Restart
          </button>
        )}
      </div>
    </div>
  );
}

// ── Broker node ───────────────────────────────────────────────────────────────

interface BrokerNodeData extends Record<string, unknown> {
  mode: string;
  brokersOnline: number;
  controllerEpoch: number;
  topicCount: number;
}

function BrokerNode({ data: rawData }: NodeProps<Node<BrokerNodeData>>) {
  const data = rawData as BrokerNodeData;
  return (
    <div className="rounded-xl border-2 border-blue-700/60 bg-blue-950/60 p-3 w-44 shadow-lg">
      <Handle type="source" position={Position.Right} style={{ background: "#3b82f6", border: "none" }} />
      <Handle type="target" position={Position.Left}  style={{ background: "#3b82f6", border: "none" }} />
      <div className="text-xs font-bold text-blue-300 mb-1.5">Kafka Broker</div>
      <div className="space-y-0.5">
        {[
          ["Mode",    data.mode],
          ["Online",  `${data.brokersOnline}/3`],
          ["Epoch",   String(data.controllerEpoch)],
          ["Topics",  String(data.topicCount)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between text-[10px]">
            <span className="text-slate-500">{k}</span>
            <span className="text-slate-300 font-semibold">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const nodeTypes = { agent: AgentNode, broker: BrokerNode };

// ── Layout positions ──────────────────────────────────────────────────────────

const NODE_POS: Record<string, { x: number; y: number }> = {
  broker:       { x: 60,  y: 200 },
  intake:       { x: 280, y: 200 },
  monitor:      { x: 500, y: 100 },
  writer:       { x: 720, y: 100 },
  notification: { x: 720, y: 300 },
};

const EDGE_DEFS = [
  { id: "e-req",   source: "broker",       target: "intake",       label: "ops.requests.v1" },
  { id: "e-met",   source: "intake",       target: "monitor",      label: "ops.kafka.metrics.v1" },
  { id: "e-inc",   source: "monitor",      target: "writer",       label: "ops.incidents.v1" },
  { id: "e-aud",   source: "writer",       target: "notification", label: "ops.actions.audit.v1" },
  { id: "e-learn", source: "monitor",      target: "monitor",      label: "ops.lessons.v1" },
  { id: "e-notif", source: "notification", target: "broker",       label: "ops.notifications.v1" },
];

// ── AgentCanvas ───────────────────────────────────────────────────────────────

interface Props {
  agents: AgentState[];
  broker: { mode: string; brokersOnline: number; controllerEpoch: number; topics: Record<string, unknown> } | null;
  activeParticles: { edgeId: string }[];
  onKill: (id: string) => void;
  onRestart: (id: string) => void;
}

export default function AgentCanvas({ agents, broker, activeParticles, onKill, onRestart }: Props) {
  const agentMap = useMemo(() => Object.fromEntries(agents.map((a) => [a.id, a])), [agents]);
  const activeEdgeIds = useMemo(() => new Set(activeParticles.map((p) => p.edgeId)), [activeParticles]);

  const nodes: Node[] = useMemo(() => {
    const list: Node[] = [];

    if (broker) {
      list.push({
        id: "broker", type: "broker",
        position: NODE_POS.broker,
        data: {
          mode: broker.mode,
          brokersOnline: broker.brokersOnline,
          controllerEpoch: broker.controllerEpoch,
          topicCount: Object.keys(broker.topics).length,
        },
      });
    }

    for (const [id, pos] of Object.entries(NODE_POS)) {
      if (id === "broker") continue;
      const agent = agentMap[id];
      if (!agent) continue;
      list.push({
        id, type: "agent",
        position: pos,
        data: { agent, onKill, onRestart },
      });
    }

    return list;
  }, [agentMap, broker, onKill, onRestart]);

  const edges: Edge[] = useMemo(() =>
    EDGE_DEFS.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: activeEdgeIds.has(e.id),
      style: {
        stroke: activeEdgeIds.has(e.id) ? "#3b82f6" : "#334155",
        strokeWidth: activeEdgeIds.has(e.id) ? 2.5 : 1.5,
      },
      labelStyle: { fontSize: 9, fill: "#64748b" },
      labelBgStyle: { fill: "#1e293b", fillOpacity: 0.8 },
    })),
  [activeEdgeIds]);

  const onNodeClick = useCallback(() => {}, []);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-slate-700/50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
