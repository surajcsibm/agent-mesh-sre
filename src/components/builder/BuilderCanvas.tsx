"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { useBuilder, PALETTE_TEMPLATES } from "@/lib/builder-store";
import { BuilderNode } from "./BuilderNode";
import { BuilderEdge } from "./BuilderEdge";
import { BUILDER_PALETTE_DRAG_TYPE } from "./BuilderPalette";

const nodeTypes = { agent: BuilderNode };
const edgeTypes = { topic: BuilderEdge };

export function BuilderCanvas() {
  return (
    <ReactFlowProvider>
      <Inner />
    </ReactFlowProvider>
  );
}

function Inner() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  const agents = useBuilder((s) => s.design.agents);
  const topics = useBuilder((s) => s.design.topics);
  const selection = useBuilder((s) => s.selection);
  const addAgent = useBuilder((s) => s.addAgent);
  const moveAgent = useBuilder((s) => s.moveAgent);
  const addTopic = useBuilder((s) => s.addTopic);
  const removeAgent = useBuilder((s) => s.removeAgent);
  const removeTopic = useBuilder((s) => s.removeTopic);
  const select = useBuilder((s) => s.select);

  const nodes: Node[] = useMemo(
    () =>
      agents.map((a) => ({
        id: a.id,
        type: "agent",
        position: a.position,
        data: { agent: a },
        selected: selection?.kind === "agent" && selection.id === a.id,
        draggable: true,
      })),
    [agents, selection]
  );

  const edges: Edge[] = useMemo(
    () =>
      topics.map((t) => {
        const audit = t.topic.includes("audit");
        const compact = t.cleanupPolicy.includes("compact");
        const color = audit ? "#fbbf24" : compact ? "#a78bfa" : "rgba(180, 200, 240, 0.7)";
        return {
          id: t.id,
          source: t.source,
          target: t.target,
          sourceHandle: t.source === t.target ? "self-out" : undefined,
          targetHandle: t.source === t.target ? "self-in" : undefined,
          type: "topic",
          data: { topic: t },
          markerEnd: { type: MarkerType.ArrowClosed, color },
          selected: selection?.kind === "topic" && selection.id === t.id,
        };
      }),
    [topics, selection]
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return;
      addTopic({
        source: c.source,
        target: c.target,
        topic: `ops.untitled.${(topics.length + 1).toString().padStart(3, "0")}.v1`,
        partitions: 3,
        cleanupPolicy: "delete",
        retentionMs: 7 * 24 * 3600 * 1000,
      });
    },
    [addTopic, topics.length]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const ch of changes) {
        if (ch.type === "position" && ch.position && !ch.dragging) {
          moveAgent(ch.id, ch.position);
        }
        if (ch.type === "remove") {
          removeAgent(ch.id);
        }
      }
    },
    [moveAgent, removeAgent]
  );

  const onEdgesChange = useCallback(
    (changes: { type: string; id: string }[]) => {
      for (const ch of changes) {
        if (ch.type === "remove") removeTopic(ch.id);
      }
    },
    [removeTopic]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const idxStr = e.dataTransfer.getData(BUILDER_PALETTE_DRAG_TYPE);
      if (!idxStr) return;
      const tpl = PALETTE_TEMPLATES[Number(idxStr)];
      if (!tpl) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addAgent({
        ...tpl,
        position,
      });
    },
    [addAgent, screenToFlowPosition]
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onPaneClick = useCallback(() => {
    select(null);
  }, [select]);

  return (
    <div className="w-full h-full relative" ref={wrapperRef} onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onConnect={onConnect}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange as never}
        onNodeClick={(_, n) => select({ kind: "agent", id: n.id })}
        onEdgeClick={(_, ed) => select({ kind: "topic", id: ed.id })}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.18, minZoom: 0.55, maxZoom: 1.15 }}
        minZoom={0.4}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "topic" }}
        connectionLineStyle={{ stroke: "rgba(167, 139, 250, 0.7)", strokeWidth: 2 }}
        panOnScroll
        panOnDrag={[1, 2]}
        selectionOnDrag
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1.2} color="rgba(255,255,255,0.06)" />
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>
      {agents.length === 0 && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="rounded-2xl border border-white/10 bg-bg-elev/80 backdrop-blur-md px-6 py-5 text-center max-w-md">
            <div className="text-[14px] font-semibold text-fg-base mb-1">Your canvas is empty</div>
            <div className="text-[11.5px] text-fg-muted leading-relaxed">
              Drag any agent template from the left palette onto the canvas, then drag from a node&#39;s right edge to another node to draw a Kafka topic.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
