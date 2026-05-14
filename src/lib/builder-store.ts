"use client";

/**
 * State container for the workflow Builder route.
 *
 * Pure client-side: holds the in-progress mesh design (nodes + edges +
 * metadata) and persists it to localStorage. Has no dependency on the
 * running mesh runtime — designs created here can be exported as JSON
 * (and eventually applied as Strimzi KafkaTopic + KafkaUser CRs).
 */
import { create } from "zustand";

export type BuilderAccent = "cyan" | "violet" | "emerald" | "amber" | "rose";

export type BuilderAgentRole =
  | "intake"
  | "monitor"
  | "writer"
  | "notification"
  | "policy"
  | "custom";

export type BuilderAgent = {
  /** node id (also used as React Flow node id) */
  id: string;
  name: string;
  role: BuilderAgentRole;
  description: string;
  tools: string[];
  accent: BuilderAccent;
  position: { x: number; y: number };
};

export type BuilderTopic = {
  /** edge id (also used as React Flow edge id) */
  id: string;
  source: string;
  target: string;
  /** Kafka topic name */
  topic: string;
  partitions: number;
  cleanupPolicy: "delete" | "compact" | "compact,delete";
  retentionMs: number;
  /** Optional contract identifier shown on the edge label. */
  contract?: string;
};

export type BuilderDesign = {
  id: string;
  name: string;
  description: string;
  agents: BuilderAgent[];
  topics: BuilderTopic[];
  createdAt: string;
  updatedAt: string;
};

type Selection =
  | { kind: "agent"; id: string }
  | { kind: "topic"; id: string }
  | null;

type BuilderState = {
  design: BuilderDesign;
  selection: Selection;

  addAgent: (a: Omit<BuilderAgent, "id"> & { id?: string }) => string;
  updateAgent: (id: string, patch: Partial<Omit<BuilderAgent, "id">>) => void;
  moveAgent: (id: string, position: { x: number; y: number }) => void;
  removeAgent: (id: string) => void;

  addTopic: (t: Omit<BuilderTopic, "id"> & { id?: string }) => string;
  updateTopic: (id: string, patch: Partial<Omit<BuilderTopic, "id">>) => void;
  removeTopic: (id: string) => void;

  setMeta: (patch: Partial<Pick<BuilderDesign, "name" | "description">>) => void;
  select: (s: Selection) => void;
  reset: () => void;
  load: (design: BuilderDesign) => void;
  exportJson: () => string;
};

const STORAGE_KEY = "ams.builder.v1";

let counter = 0;
function genId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export const DEFAULT_DESIGN = (): BuilderDesign => ({
  id: genId("design"),
  name: "Untitled mesh",
  description: "",
  agents: [],
  topics: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const STARTER_DESIGN = (): BuilderDesign => {
  const intakeId = genId("agent");
  const monitorId = genId("agent");
  const writerId = genId("agent");
  const notifId = genId("agent");
  const now = new Date().toISOString();
  return {
    id: genId("design"),
    name: "Agent Mesh on Streaming World — starter",
    description: "Mirror of the live demo topology. Drag the palette to add more agents, then save.",
    createdAt: now,
    updatedAt: now,
    agents: [
      { id: intakeId, name: "Intake Agent", role: "intake", description: "MCP gateway. Validates + signs operator requests.", tools: ["intake.submitOpsRequest"], accent: "cyan", position: { x: 80, y: 200 } },
      { id: monitorId, name: "Monitor Agent", role: "monitor", description: "M-R-A-L brain. Reasons over kafka.metrics, requests, lessons.", tools: ["kafka.scaleConsumers", "kafka.acknowledgeFailover", "kafka.shareGroupCheckpoint"], accent: "violet", position: { x: 460, y: 200 } },
      { id: writerId, name: "Writer Agent", role: "writer", description: "Drafts incident reports + commits to ops.actions.audit.v1.", tools: ["writer.draftIncidentReport"], accent: "emerald", position: { x: 840, y: 200 } },
      { id: notifId, name: "Notification Agent", role: "notification", description: "Closes the loop — Slack + ITSM integration.", tools: ["notify.slack", "itsm.openTicket"], accent: "amber", position: { x: 1220, y: 200 } },
    ],
    topics: [
      { id: genId("edge"), source: intakeId, target: monitorId, topic: "ops.requests.v1", partitions: 3, cleanupPolicy: "delete", retentionMs: 7 * 24 * 3600 * 1000, contract: "asyncapi://ops.requests.v1#1" },
      { id: genId("edge"), source: monitorId, target: writerId, topic: "ops.incidents.v1", partitions: 3, cleanupPolicy: "delete", retentionMs: 7 * 24 * 3600 * 1000, contract: "asyncapi://ops.incidents.v1#1" },
      { id: genId("edge"), source: writerId, target: notifId, topic: "ops.actions.audit.v1", partitions: 3, cleanupPolicy: "delete", retentionMs: 365 * 24 * 3600 * 1000, contract: "asyncapi://ops.actions.audit.v1#1" },
      { id: genId("edge"), source: monitorId, target: monitorId, topic: "ops.lessons.v1", partitions: 1, cleanupPolicy: "compact", retentionMs: -1, contract: "asyncapi://ops.lessons.v1#1" },
    ],
  };
};

function load(): BuilderDesign {
  if (typeof window === "undefined") return DEFAULT_DESIGN();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as BuilderDesign;
  } catch {
    /* ignore */
  }
  return STARTER_DESIGN();
}

function persist(d: BuilderDesign): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch {
    /* quota / private mode */
  }
}

const stamped = (d: BuilderDesign): BuilderDesign => ({ ...d, updatedAt: new Date().toISOString() });

export const useBuilder = create<BuilderState>((set, get) => ({
  design: load(),
  selection: null,

  addAgent: (a) => {
    const id = a.id ?? genId("agent");
    const next = stamped({ ...get().design, agents: [...get().design.agents, { ...a, id }] });
    persist(next);
    set({ design: next, selection: { kind: "agent", id } });
    return id;
  },
  updateAgent: (id, patch) => {
    const agents = get().design.agents.map((x) => (x.id === id ? { ...x, ...patch } : x));
    const next = stamped({ ...get().design, agents });
    persist(next);
    set({ design: next });
  },
  moveAgent: (id, position) => {
    const agents = get().design.agents.map((x) => (x.id === id ? { ...x, position } : x));
    const next = stamped({ ...get().design, agents });
    persist(next);
    set({ design: next });
  },
  removeAgent: (id) => {
    const agents = get().design.agents.filter((x) => x.id !== id);
    const topics = get().design.topics.filter((t) => t.source !== id && t.target !== id);
    const next = stamped({ ...get().design, agents, topics });
    persist(next);
    set({ design: next, selection: null });
  },

  addTopic: (t) => {
    const id = t.id ?? genId("edge");
    const next = stamped({ ...get().design, topics: [...get().design.topics, { ...t, id }] });
    persist(next);
    set({ design: next, selection: { kind: "topic", id } });
    return id;
  },
  updateTopic: (id, patch) => {
    const topics = get().design.topics.map((x) => (x.id === id ? { ...x, ...patch } : x));
    const next = stamped({ ...get().design, topics });
    persist(next);
    set({ design: next });
  },
  removeTopic: (id) => {
    const topics = get().design.topics.filter((t) => t.id !== id);
    const next = stamped({ ...get().design, topics });
    persist(next);
    set({ design: next, selection: null });
  },

  setMeta: (patch) => {
    const next = stamped({ ...get().design, ...patch });
    persist(next);
    set({ design: next });
  },
  select: (s) => set({ selection: s }),
  reset: () => {
    const d = STARTER_DESIGN();
    persist(d);
    set({ design: d, selection: null });
  },
  load: (d) => {
    persist(d);
    set({ design: d, selection: null });
  },
  exportJson: () => JSON.stringify(get().design, null, 2),
}));

export const PALETTE_TEMPLATES: Array<Omit<BuilderAgent, "id" | "position">> = [
  { name: "Intake Agent", role: "intake", description: "MCP gateway. Validates + signs operator requests, publishes to ops.requests.v1.", tools: ["intake.submitOpsRequest"], accent: "cyan" },
  { name: "Monitor Agent", role: "monitor", description: "Monitor → Reason → Act → Learn. Cross-references rebalance state, KRaft epoch, share-group offsets.", tools: ["kafka.scaleConsumers", "kafka.acknowledgeFailover", "kafka.shareGroupCheckpoint"], accent: "violet" },
  { name: "Writer Agent", role: "writer", description: "Authors incident reports. Consumes ops.incidents.v1, publishes ops.actions.audit.v1.", tools: ["writer.draftIncidentReport"], accent: "emerald" },
  { name: "Notification Agent", role: "notification", description: "Closes the loop. Slack + ITSM. Consumes ops.actions.audit.v1.", tools: ["notify.slack", "itsm.openTicket"], accent: "amber" },
  { name: "Policy Agent", role: "policy", description: "Approval gate. Holds high-risk tool calls until a human approves.", tools: ["policy.evaluate", "policy.approve", "policy.reject"], accent: "rose" },
  { name: "Custom Agent", role: "custom", description: "Blank slate. Wire it up however you like.", tools: [], accent: "cyan" },
];
