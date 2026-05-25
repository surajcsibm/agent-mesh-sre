"use client";

import { useMemo } from "react";
import { ReactFlow, Handle, Position } from "@xyflow/react";
import type { Node, Edge, NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { AgentState, MralPhase } from "@/lib/types";

// ── Agent accent colours (per wireframe) ─────────────────────────────────────
const ACCENT: Record<string, string> = {
  intake:       "#1D9E75",
  monitor:      "#7c3aed",
  writer:       "#1D9E75",
  notification: "#f97316",
};

const DISPLAY_NAME: Record<string, string> = {
  intake:       "INTAKE",
  monitor:      "MONITOR",
  writer:       "WRITER",
  notification: "NOTIFY",
};

const SUBTITLE: Record<string, string> = {
  intake:       "MCP Gateway",
  monitor:      "SRE Brain",
  writer:       "Postmortem Author",
  notification: "Outbound Routing",
};

const STATUS_DOT: Record<string, string> = {
  online:              "#1D9E75",
  reasoning:           "#7c3aed",
  acting:              "#ea580c",
  "awaiting-approval": "#d97706",
  crashed:             "#dc2626",
  replaying:           "#0891b2",
  idle:                "#94a3b8",
};

// ── Invisible handle style ────────────────────────────────────────────────────
const H: React.CSSProperties = { opacity: 0, width: 6, height: 6, minWidth: 6, minHeight: 6 };

// ── AgentNode ─────────────────────────────────────────────────────────────────

interface AgentNodeData extends Record<string, unknown> {
  agent: AgentState;
  onKill:    (id: string) => void;
  onRestart: (id: string) => void;
}

function AgentNode({ data: rawData }: NodeProps<Node<AgentNodeData>>) {
  const { agent, onKill, onRestart } = rawData as AgentNodeData;

  const accent     = ACCENT[agent.id]    ?? "#1D9E75";
  const dotColor   = STATUS_DOT[agent.status] ?? "#94a3b8";
  const crashed    = agent.status === "crashed";
  const isActive   = ["reasoning", "acting"].includes(agent.status);
  const isAwaiting = agent.status === "awaiting-approval";
  const glow       = isAwaiting ? "#d97706" : accent;

  return (
    <div style={{
      width: 138,
      background: "#ffffff",
      border: `1.5px solid ${crashed ? "#fca5a5" : accent}`,
      borderRadius: 12,
      padding: "12px 12px 10px",
      boxShadow: (isActive || isAwaiting)
        ? `0 0 0 3px ${glow}25, 0 6px 24px ${glow}22`
        : "0 1px 6px rgba(30,58,95,0.07)",
      transform: (isActive || isAwaiting) ? "scale(1.05)" : "scale(1)",
      transition: "all 0.3s ease",
    }}>
      {/* 8 invisible handles (source + target on each side) for clean edge routing */}
      <Handle type="source" position={Position.Top}    id="st" style={H} />
      <Handle type="target" position={Position.Top}    id="tt" style={{ ...H, left: "60%" }} />
      <Handle type="source" position={Position.Right}  id="sr" style={H} />
      <Handle type="target" position={Position.Right}  id="tr" style={{ ...H, top: "62%" }} />
      <Handle type="source" position={Position.Bottom} id="sb" style={H} />
      <Handle type="target" position={Position.Bottom} id="tb" style={{ ...H, left: "60%" }} />
      <Handle type="source" position={Position.Left}   id="sl" style={H} />
      <Handle type="target" position={Position.Left}   id="tl" style={{ ...H, top: "62%" }} />

      {/* Name */}
      <div style={{
        fontSize: 11, fontWeight: 800, letterSpacing: "0.7px",
        color: accent, textTransform: "uppercase", marginBottom: 3, lineHeight: 1.3,
      }}>
        {DISPLAY_NAME[agent.id] ?? agent.id.toUpperCase()}
      </div>

      {/* Subtitle / role */}
      <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 10, lineHeight: 1.4 }}>
        {SUBTITLE[agent.id] ?? agent.role}
      </div>

      {/* Status dot — centred, pulsing */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
        <span style={{
          width: 10, height: 10, borderRadius: "50%", background: dotColor,
          display: "block", boxShadow: `0 0 0 3px ${dotColor}20`,
          animation: "pulse 2s infinite",
        }} />
      </div>

      {/* Kill / Restart */}
      {!crashed ? (
        <button
          onClick={() => onKill(agent.id)}
          style={{
            width: "100%", fontSize: 8, fontWeight: 600, padding: "2px 0",
            background: "rgba(220,38,38,0.05)", color: "#dc2626",
            border: "1px solid rgba(220,38,38,0.18)", borderRadius: 4, cursor: "pointer",
          }}
        >Kill</button>
      ) : (
        <button
          onClick={() => onRestart(agent.id)}
          style={{
            width: "100%", fontSize: 8, fontWeight: 600, padding: "2px 0",
            background: "rgba(29,158,117,0.07)", color: "#1D9E75",
            border: "1px solid rgba(29,158,117,0.22)", borderRadius: 4, cursor: "pointer",
          }}
        >Restart</button>
      )}
    </div>
  );
}

// ── BrokerNode ────────────────────────────────────────────────────────────────

interface BrokerNodeData extends Record<string, unknown> {
  mode: string;
  brokersOnline: number;
  controllerEpoch: number;
  topicCount: number;
  mtls?: boolean;
  sasl?: boolean;
}

function BrokerNode({ data: rawData }: NodeProps<Node<BrokerNodeData>>) {
  const d = rawData as BrokerNodeData;
  const secure = d.mtls !== false && d.sasl !== false;

  return (
    <div style={{
      width: 150,
      background: "#ffffff",
      border: "1.5px solid #3b82f6",
      borderRadius: 12,
      padding: "12px 12px 12px",
      boxShadow: "0 2px 12px rgba(59,130,246,0.12)",
    }}>
      <Handle type="source" position={Position.Top}    id="st" style={H} />
      <Handle type="target" position={Position.Top}    id="tt" style={{ ...H, left: "60%" }} />
      <Handle type="source" position={Position.Right}  id="sr" style={H} />
      <Handle type="target" position={Position.Right}  id="tr" style={{ ...H, top: "62%" }} />
      <Handle type="source" position={Position.Bottom} id="sb" style={H} />
      <Handle type="target" position={Position.Bottom} id="tb" style={{ ...H, left: "60%" }} />
      <Handle type="source" position={Position.Left}   id="sl" style={H} />
      <Handle type="target" position={Position.Left}   id="tl" style={{ ...H, top: "62%" }} />

      <div style={{
        fontSize: 11, fontWeight: 800, letterSpacing: "0.7px",
        color: "#3b82f6", textTransform: "uppercase", marginBottom: 4,
      }}>
        BROKER
      </div>
      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>
        {d.mode} · {d.brokersOnline} online
      </div>
      <div style={{ fontSize: 9, color: secure ? "#1D9E75" : "#f97316", fontWeight: 600 }}>
        mTLS + SASL {secure ? "✓" : "✗"}
      </div>
      <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 3 }}>
        {d.topicCount} topics · epoch {d.controllerEpoch}
      </div>
    </div>
  );
}

const nodeTypes = { agent: AgentNode, broker: BrokerNode };

// ── Node positions — 2×2 agents + Broker in centre (per wireframe) ────────────
//
//   [INTAKE]              [WRITER]
//            [BROKER]
//   [MONITOR]             [NOTIFY]
//
const NODE_POS: Record<string, { x: number; y: number }> = {
  intake:       { x: 30,  y: 40  },
  writer:       { x: 490, y: 40  },
  broker:       { x: 258, y: 192 },
  monitor:      { x: 30,  y: 350 },
  notification: { x: 490, y: 350 },
};

// ── Edge colours (inactive state, per wireframe accent colours) ───────────────
const EDGE_COLOR: Record<string, string> = {
  "e-req":   "#1D9E75",   // broker → intake  (emerald)
  "e-met":   "#7c3aed",   // intake → monitor (violet)
  "e-inc":   "#1D9E75",   // monitor → writer (emerald)
  "e-aud":   "#f97316",   // writer → notify  (orange)
  "e-notif": "#3b82f6",   // notify → broker  (blue)
  "e-learn": "#7c3aed",   // monitor → broker (violet)
};

// Edge definitions with specific source/target handles for clean 2×2 routing
const EDGE_DEFS = [
  { id: "e-req",   source: "broker",       target: "intake",       label: "ops.requests",  sh: "sl", th: "sr"  },
  { id: "e-met",   source: "intake",       target: "monitor",      label: "ops.metrics",   sh: "sb", th: "tt"  },
  { id: "e-inc",   source: "monitor",      target: "writer",       label: "ops.incidents", sh: "sr", th: "sl"  },
  { id: "e-aud",   source: "writer",       target: "notification", label: "ops.audit",     sh: "sb", th: "tt"  },
  { id: "e-notif", source: "notification", target: "broker",       label: "ops.notify",    sh: "sl", th: "tr"  },
  { id: "e-learn", source: "monitor",      target: "broker",       label: "ops.lessons",   sh: "sr", th: "tl"  },
];

// ── AgentCanvas ───────────────────────────────────────────────────────────────

interface Props {
  agents: AgentState[];
  broker: {
    mode: string;
    brokersOnline: number;
    controllerEpoch: number;
    topics: Record<string, unknown>;
    mtls?: boolean;
    sasl?: boolean;
  } | null;
  activeParticles: { edgeId: string }[];
  onKill:    (id: string) => void;
  onRestart: (id: string) => void;
}

export default function AgentCanvas({ agents, broker, activeParticles, onKill, onRestart }: Props) {
  const agentMap      = useMemo(() => Object.fromEntries(agents.map(a => [a.id, a])), [agents]);
  const activeEdgeIds = useMemo(() => new Set(activeParticles.map(p => p.edgeId)), [activeParticles]);

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
          mtls: broker.mtls,
          sasl: broker.sasl,
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
    EDGE_DEFS.map(e => {
      const active    = activeEdgeIds.has(e.id);
      const baseColor = EDGE_COLOR[e.id] ?? "#94a3b8";
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: "bezier",
        sourceHandle: e.sh,
        targetHandle: e.th,
        label: e.label,
        animated: active,
        style: {
          stroke:           active ? "#1D9E75" : baseColor,
          strokeWidth:      active ? 2.5 : 1.5,
          strokeDasharray:  active ? undefined : "7 4",
          opacity:          active ? 1 : 0.5,
        },
        labelStyle:         { fontSize: 8, fill: "#94a3b8" },
        labelBgStyle:       { fill: "rgba(255,255,255,0.85)", fillOpacity: 0.85 },
        labelBgPadding:     [4, 2] as [number, number],
        labelBgBorderRadius: 3,
      };
    }),
  [activeEdgeIds]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1.15 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        style={{ background: "transparent" }}
      />
    </div>
  );
}
