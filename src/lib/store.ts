"use client";

import { create } from "zustand";
import type {
  AgentId,
  AgentRuntimeState,
  ApprovalRequest,
  AuditEvent,
  ClusterStatus,
  IncidentEvent,
  KafkaRecord,
  LessonRecord,
  NotificationEvent,
  ParticleHint,
  SnapshotPayload,
  TopicName,
  WireEvent,
} from "./types";

interface LogLine {
  id: number;
  ts: number;
  agent: AgentId | "system";
  level: "info" | "warn" | "error";
  message: string;
}

interface ParticleInstance extends ParticleHint {
  startedAt: number;
}

interface MeshState {
  connected: boolean;
  agents: Record<AgentId, AgentRuntimeState> | null;
  cluster: ClusterStatus | null;
  approvals: ApprovalRequest[];
  incidents: IncidentEvent[];
  audit: AuditEvent[];
  notifications: NotificationEvent[];
  lessons: LessonRecord[];
  topics: SnapshotPayload["topics"] | null;
  recentTopicRecords: Record<TopicName, KafkaRecord[]>;
  logLines: LogLine[];
  particles: ParticleInstance[];
  selection: { kind: "agent"; id: AgentId } | { kind: "edge"; topic: TopicName } | null;

  applyEvent: (e: WireEvent) => void;
  setConnected: (v: boolean) => void;
  pruneParticles: () => void;
  select: (s: MeshState["selection"]) => void;
  clearLogs: () => void;
}

let logCounter = 0;
const TOPICS: TopicName[] = [
  "ops.requests.v1",
  "ops.kafka.metrics.v1",
  "ops.incidents.v1",
  "ops.actions.audit.v1",
  "ops.lessons.v1",
  "ops.notifications.v1",
];
const emptyTopicRecs = (): Record<TopicName, KafkaRecord[]> =>
  Object.fromEntries(TOPICS.map((t) => [t, [] as KafkaRecord[]])) as Record<TopicName, KafkaRecord[]>;

export const useMesh = create<MeshState>((set, get) => ({
  connected: false,
  agents: null,
  cluster: null,
  approvals: [],
  incidents: [],
  audit: [],
  notifications: [],
  lessons: [],
  topics: null,
  recentTopicRecords: emptyTopicRecs(),
  logLines: [],
  particles: [],
  selection: null,

  setConnected: (v) => set({ connected: v }),

  select: (s) => set({ selection: s }),

  clearLogs: () => set({ logLines: [] }),

  pruneParticles: () => {
    const now = Date.now();
    set({
      particles: get().particles.filter((p) => now - p.startedAt < p.durationMs + 200),
    });
  },

  applyEvent: (e) => {
    switch (e.kind) {
      case "snapshot": {
        const recents = emptyTopicRecs();
        for (const t of TOPICS) recents[t] = e.payload.topics[t]?.recentRecords ?? [];
        set({
          agents: e.payload.agents,
          cluster: e.payload.cluster,
          approvals: e.payload.approvals,
          incidents: e.payload.incidents,
          audit: e.payload.audit,
          notifications: e.payload.notifications,
          lessons: e.payload.lessons,
          topics: e.payload.topics,
          recentTopicRecords: recents,
        });
        break;
      }
      case "agent-state": {
        const agents = { ...(get().agents ?? {}) } as Record<AgentId, AgentRuntimeState>;
        agents[e.payload.agent] = e.payload.state;
        set({ agents });
        break;
      }
      case "approval-new": {
        set({ approvals: [...get().approvals, e.payload].slice(-25) });
        break;
      }
      case "approval-update": {
        const list = get().approvals.map((a) => (a.id === e.payload.id ? e.payload : a));
        set({ approvals: list });
        break;
      }
      case "incident": {
        set({ incidents: [...get().incidents, e.payload].slice(-30) });
        break;
      }
      case "audit": {
        set({ audit: [...get().audit, e.payload].slice(-200) });
        break;
      }
      case "notification": {
        set({ notifications: [...get().notifications, e.payload].slice(-30) });
        break;
      }
      case "lesson": {
        set({ lessons: [...get().lessons, e.payload].slice(-25) });
        break;
      }
      case "topic-record": {
        const topic = e.payload.topic as TopicName;
        const recents = { ...get().recentTopicRecords };
        recents[topic] = [e.payload, ...(recents[topic] ?? [])].slice(0, 30);
        const topics = { ...(get().topics ?? {}) } as SnapshotPayload["topics"];
        const existing = topics[topic] ?? { partitions: 1, logEndOffset: 0, recentRecords: [] };
        topics[topic] = {
          ...existing,
          logEndOffset: existing.logEndOffset + 1,
          recentRecords: recents[topic],
        };
        set({ recentTopicRecords: recents, topics });
        break;
      }
      case "particle": {
        const next = [...get().particles, { ...e.payload, startedAt: Date.now() }];
        // hard cap so we don't leak nodes
        set({ particles: next.slice(-80) });
        break;
      }
      case "log": {
        const line: LogLine = { id: ++logCounter, ...e.payload };
        set({ logLines: [...get().logLines, line].slice(-200) });
        break;
      }
    }
  },
}));
