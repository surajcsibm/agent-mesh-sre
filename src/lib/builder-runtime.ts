/**
 * Client-side flow simulator for the Builder canvas.
 *
 * The builder isn't backed by a server runtime (the curated 4-agent demo on
 * `/` is). Instead, when the user clicks "Run on canvas", this module:
 *  - Fires synthetic publish events along every edge in the design at a
 *    user-tunable speed.
 *  - Tracks an in-flight "particle" per emit (id + edge id + start timestamp)
 *    so the BuilderCanvas can animate them along the React-Flow path.
 *  - Tracks per-edge counters so the inspector can show a running total.
 *
 * Every publish lifecycle is purely local. Nothing is sent to the server.
 * Stop the runtime to drain everything. Resetting the design clears state.
 */
import { create } from "zustand";
import type { BuilderDesign } from "./builder-store";

export type Particle = {
  id: string;
  edgeId: string;
  startedAt: number;
  durationMs: number;
};

export type EdgeStat = {
  emitted: number;
  lastEmittedAt: number | null;
};

type RuntimeState = {
  running: boolean;
  speed: number; // events per second across the whole mesh
  particles: Particle[];
  edgeStats: Record<string, EdgeStat>;

  start: (design: BuilderDesign) => void;
  stop: () => void;
  reset: () => void;
  setSpeed: (s: number) => void;
};

let tickerId: ReturnType<typeof setInterval> | null = null;
let cleanupId: ReturnType<typeof setInterval> | null = null;
let cachedDesign: BuilderDesign | null = null;

const PARTICLE_DURATION_MS = 1500;

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const useBuilderRuntime = create<RuntimeState>((set, get) => ({
  running: false,
  speed: 2.5,
  particles: [],
  edgeStats: {},

  start: (design) => {
    cachedDesign = design;
    if (get().running) return;

    set({ running: true });
    scheduleTicker(get, set);
    scheduleCleanup(set);
  },

  stop: () => {
    if (tickerId) {
      clearInterval(tickerId);
      tickerId = null;
    }
    if (cleanupId) {
      clearInterval(cleanupId);
      cleanupId = null;
    }
    set({ running: false, particles: [] });
  },

  reset: () => {
    if (tickerId) clearInterval(tickerId);
    if (cleanupId) clearInterval(cleanupId);
    tickerId = null;
    cleanupId = null;
    cachedDesign = null;
    set({ running: false, particles: [], edgeStats: {} });
  },

  setSpeed: (s) => {
    set({ speed: clamp(s, 0.5, 12) });
    if (get().running) {
      scheduleTicker(get, set);
    }
  },
}));

function scheduleTicker(
  get: () => RuntimeState,
  set: (
    partial: Partial<RuntimeState> | ((s: RuntimeState) => Partial<RuntimeState>)
  ) => void
) {
  if (tickerId) clearInterval(tickerId);
  const speed = get().speed;
  // emit one record every (1000 / speed) ms; pick a random edge each time
  const intervalMs = Math.max(40, Math.round(1000 / speed));
  tickerId = setInterval(() => {
    const design = cachedDesign;
    if (!design || design.topics.length === 0) return;
    const edge = design.topics[Math.floor(Math.random() * design.topics.length)];
    const p: Particle = {
      id: genId(),
      edgeId: edge.id,
      startedAt: Date.now(),
      durationMs: PARTICLE_DURATION_MS,
    };
    set((s) => {
      const prev = s.edgeStats[edge.id] ?? { emitted: 0, lastEmittedAt: null };
      return {
        particles: [...s.particles, p].slice(-200),
        edgeStats: {
          ...s.edgeStats,
          [edge.id]: { emitted: prev.emitted + 1, lastEmittedAt: p.startedAt },
        },
      };
    });
  }, intervalMs);
}

function scheduleCleanup(
  set: (
    partial: Partial<RuntimeState> | ((s: RuntimeState) => Partial<RuntimeState>)
  ) => void
) {
  if (cleanupId) clearInterval(cleanupId);
  cleanupId = setInterval(() => {
    const cutoff = Date.now() - PARTICLE_DURATION_MS;
    set((s) => ({
      particles: s.particles.filter((p) => p.startedAt + p.durationMs > cutoff),
    }));
  }, 250);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
