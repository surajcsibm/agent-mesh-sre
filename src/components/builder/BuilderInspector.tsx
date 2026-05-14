"use client";

import { useState } from "react";
import { Bot, Database, Plus, Trash2, X, Wrench } from "lucide-react";
import { useBuilder, type BuilderAccent, type BuilderAgent, type BuilderAgentRole, type BuilderTopic } from "@/lib/builder-store";

const ACCENTS: { value: BuilderAccent; rgb: string }[] = [
  { value: "cyan", rgb: "34, 211, 238" },
  { value: "violet", rgb: "167, 139, 250" },
  { value: "emerald", rgb: "52, 211, 153" },
  { value: "amber", rgb: "251, 191, 36" },
  { value: "rose", rgb: "251, 113, 133" },
];

const ROLES: BuilderAgentRole[] = ["intake", "monitor", "writer", "notification", "policy", "custom"];

const RETENTIONS: { label: string; ms: number }[] = [
  { label: "1 hour", ms: 3600 * 1000 },
  { label: "12 hours", ms: 12 * 3600 * 1000 },
  { label: "1 day", ms: 24 * 3600 * 1000 },
  { label: "7 days", ms: 7 * 24 * 3600 * 1000 },
  { label: "30 days", ms: 30 * 24 * 3600 * 1000 },
  { label: "365 days", ms: 365 * 24 * 3600 * 1000 },
  { label: "infinite (compacted)", ms: -1 },
];

export function BuilderInspector() {
  const selection = useBuilder((s) => s.selection);
  const agents = useBuilder((s) => s.design.agents);
  const topics = useBuilder((s) => s.design.topics);
  const setMeta = useBuilder((s) => s.setMeta);
  // IMPORTANT: select primitives only. Returning a fresh object literal from a
  // Zustand selector (e.g. `() => ({ name, description })`) breaks the
  // identity comparison and triggers an infinite re-render loop.
  const name = useBuilder((s) => s.design.name);
  const description = useBuilder((s) => s.design.description);

  if (!selection) {
    return (
      <div className="p-4 space-y-4">
        <div>
          <div className="text-[10.5px] uppercase tracking-wider font-mono text-fg-dim mb-1.5">Mesh metadata</div>
          <input
            type="text"
            value={name}
            onChange={(e) => setMeta({ name: e.target.value })}
            className="w-full text-[13px] font-semibold bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-fg-base focus:border-violet-400/50 focus:outline-none"
          />
          <textarea
            value={description}
            onChange={(e) => setMeta({ description: e.target.value })}
            placeholder="Describe what this mesh does (1-2 sentences)..."
            rows={3}
            className="w-full mt-2 text-[11.5px] bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-fg-base focus:border-violet-400/50 focus:outline-none resize-none"
          />
        </div>
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.04] p-3 text-[11.5px] text-fg-muted leading-relaxed">
          <div className="text-violet-200 font-medium mb-1">How to use the builder</div>
          <ol className="list-decimal list-inside space-y-0.5 text-fg-muted">
            <li>Drag an agent template from the left palette onto the canvas.</li>
            <li>Drag from the right side of one node to the left of another to draw a Kafka topic edge.</li>
            <li>Click a node or edge to edit its details here.</li>
            <li>Click <span className="text-fg-base font-medium">Deploy</span> to preview the AsyncAPI + Strimzi YAML this mesh would generate.</li>
          </ol>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Agents" value={agents.length} accent="violet" />
          <Stat label="Topics" value={topics.length} accent="cyan" />
        </div>
      </div>
    );
  }

  if (selection.kind === "agent") {
    const a = agents.find((x) => x.id === selection.id);
    if (!a) return null;
    return <AgentEditor agent={a} />;
  }
  const t = topics.find((x) => x.id === selection.id);
  if (!t) return null;
  return <TopicEditor topic={t} />;
}

function AgentEditor({ agent }: { agent: BuilderAgent }) {
  const update = useBuilder((s) => s.updateAgent);
  const remove = useBuilder((s) => s.removeAgent);
  const select = useBuilder((s) => s.select);
  const [tool, setTool] = useState("");

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-mono text-fg-dim">
          <Bot size={11} className="text-violet-400" /> Agent
        </div>
        <button onClick={() => select(null)} className="text-fg-dim hover:text-fg-base p-1 -m-1" title="Close">
          <X size={13} />
        </button>
      </div>

      <Field label="Name">
        <input
          type="text"
          value={agent.name}
          onChange={(e) => update(agent.id, { name: e.target.value })}
          className="w-full text-[12.5px] bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-fg-base focus:border-violet-400/50 focus:outline-none"
        />
      </Field>
      <Field label="Role">
        <select
          value={agent.role}
          onChange={(e) => update(agent.id, { role: e.target.value as BuilderAgentRole })}
          className="w-full text-[12px] bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-fg-base focus:border-violet-400/50 focus:outline-none"
        >
          {ROLES.map((r) => (
            <option key={r} value={r} className="bg-bg-elev">{r}</option>
          ))}
        </select>
      </Field>
      <Field label="Description">
        <textarea
          value={agent.description}
          onChange={(e) => update(agent.id, { description: e.target.value })}
          rows={3}
          className="w-full text-[12px] bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-fg-base focus:border-violet-400/50 focus:outline-none resize-none"
        />
      </Field>
      <Field label="Accent">
        <div className="flex gap-1.5">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => update(agent.id, { accent: a.value })}
              className="w-7 h-7 rounded-md border-2 transition-all"
              style={{
                background: `rgba(${a.rgb}, 0.25)`,
                borderColor: agent.accent === a.value ? `rgb(${a.rgb})` : "rgba(255,255,255,0.1)",
                boxShadow: agent.accent === a.value ? `0 0 12px rgba(${a.rgb}, 0.5)` : undefined,
              }}
              title={a.value}
            />
          ))}
        </div>
      </Field>

      <Field label={`MCP tools (${agent.tools.length})`}>
        <div className="space-y-1.5">
          {agent.tools.map((tn, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-md bg-white/5 border border-white/10 px-2 py-1">
              <Wrench size={10} className="text-fg-dim" />
              <span className="flex-1 text-[11px] font-mono text-fg-base truncate">{tn}</span>
              <button
                type="button"
                onClick={() => update(agent.id, { tools: agent.tools.filter((_, idx) => idx !== i) })}
                className="text-fg-dim hover:text-rose-300 p-0.5"
              >
                <X size={11} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={tool}
              onChange={(e) => setTool(e.target.value)}
              placeholder="namespace.toolName"
              className="flex-1 text-[11px] bg-white/5 border border-white/10 rounded-md px-2 py-1 text-fg-base focus:border-violet-400/50 focus:outline-none font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter" && tool.trim()) {
                  update(agent.id, { tools: [...agent.tools, tool.trim()] });
                  setTool("");
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (!tool.trim()) return;
                update(agent.id, { tools: [...agent.tools, tool.trim()] });
                setTool("");
              }}
              className="text-fg-dim hover:text-fg-base p-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/10"
            >
              <Plus size={11} />
            </button>
          </div>
        </div>
      </Field>

      <button
        type="button"
        onClick={() => remove(agent.id)}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-medium bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-200 transition-colors mt-2"
      >
        <Trash2 size={11} /> Delete agent
      </button>
    </div>
  );
}

function TopicEditor({ topic }: { topic: BuilderTopic }) {
  const agents = useBuilder((s) => s.design.agents);
  const update = useBuilder((s) => s.updateTopic);
  const remove = useBuilder((s) => s.removeTopic);
  const select = useBuilder((s) => s.select);
  const src = agents.find((a) => a.id === topic.source);
  const dst = agents.find((a) => a.id === topic.target);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-mono text-fg-dim">
          <Database size={11} className="text-violet-400" /> Kafka topic
        </div>
        <button onClick={() => select(null)} className="text-fg-dim hover:text-fg-base p-1 -m-1" title="Close">
          <X size={13} />
        </button>
      </div>

      <div className="rounded-md bg-white/5 border border-white/10 px-2.5 py-1.5 text-[11px] font-mono text-fg-muted">
        {src?.name ?? "?"} <span className="text-fg-dim">→</span> {dst?.name ?? "?"}
      </div>

      <Field label="Topic name">
        <input
          type="text"
          value={topic.topic}
          onChange={(e) => update(topic.id, { topic: e.target.value })}
          className="w-full text-[12px] bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-fg-base font-mono focus:border-violet-400/50 focus:outline-none"
          placeholder="ops.requests.v1"
        />
      </Field>
      <Field label="Partitions">
        <input
          type="number"
          min={1}
          max={64}
          value={topic.partitions}
          onChange={(e) => update(topic.id, { partitions: Math.max(1, Math.min(64, Number(e.target.value) || 1)) })}
          className="w-24 text-[12px] bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-fg-base focus:border-violet-400/50 focus:outline-none"
        />
      </Field>
      <Field label="Cleanup policy">
        <select
          value={topic.cleanupPolicy}
          onChange={(e) => update(topic.id, { cleanupPolicy: e.target.value as BuilderTopic["cleanupPolicy"] })}
          className="w-full text-[12px] bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-fg-base focus:border-violet-400/50 focus:outline-none"
        >
          <option value="delete" className="bg-bg-elev">delete (default, time-bound)</option>
          <option value="compact" className="bg-bg-elev">compact (latest-by-key)</option>
          <option value="compact,delete" className="bg-bg-elev">compact + delete (hybrid)</option>
        </select>
      </Field>
      <Field label="Retention">
        <select
          value={topic.retentionMs}
          onChange={(e) => update(topic.id, { retentionMs: Number(e.target.value) })}
          className="w-full text-[12px] bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-fg-base focus:border-violet-400/50 focus:outline-none"
        >
          {RETENTIONS.map((r) => (
            <option key={r.ms} value={r.ms} className="bg-bg-elev">{r.label}</option>
          ))}
        </select>
      </Field>
      <Field label="AsyncAPI contract URI (optional)">
        <input
          type="text"
          value={topic.contract ?? ""}
          onChange={(e) => update(topic.id, { contract: e.target.value || undefined })}
          className="w-full text-[11px] bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-fg-base font-mono focus:border-violet-400/50 focus:outline-none"
          placeholder="asyncapi://ops.requests.v1#1"
        />
      </Field>

      <button
        type="button"
        onClick={() => remove(topic.id)}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-medium bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-200 transition-colors mt-2"
      >
        <Trash2 size={11} /> Delete topic edge
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-mono text-fg-dim mb-1">{label}</div>
      {children}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: "violet" | "cyan" }) {
  const c = accent === "violet" ? "167, 139, 250" : "34, 211, 238";
  return (
    <div className="rounded-lg px-3 py-2.5 text-center" style={{ background: `rgba(${c}, 0.08)`, border: `1px solid rgba(${c}, 0.25)` }}>
      <div className="text-[9.5px] uppercase tracking-wider font-mono text-fg-dim">{label}</div>
      <div className="text-[18px] font-mono font-semibold mt-0.5" style={{ color: `rgb(${c})` }}>{value}</div>
    </div>
  );
}

