/**
 * Tiny pub-sub used by the in-process simulation to fan out events to all
 * connected SSE clients. Stored on globalThis so it survives Next.js HMR.
 */
import type { WireEvent } from "./types";

type Listener = (e: WireEvent) => void;

class EventBus {
  private listeners: Set<Listener> = new Set();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  publish(e: WireEvent): void {
    for (const l of this.listeners) {
      try {
        l(e);
      } catch {
        // ignore listener errors
      }
    }
  }

  size(): number {
    return this.listeners.size;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __agentMeshBus: EventBus | undefined;
}

export function getEventBus(): EventBus {
  if (!globalThis.__agentMeshBus) {
    globalThis.__agentMeshBus = new EventBus();
  }
  return globalThis.__agentMeshBus;
}
