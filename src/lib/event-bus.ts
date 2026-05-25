// Server-side SSE event bus — globalThis singleton (survives Next.js hot reload)
// Clients connect via GET /api/mesh/stream and receive newline-delimited JSON.

import type { BusEvent } from "./types";

type Subscriber = (event: BusEvent) => void;

interface EventBus {
  subscribe: (fn: Subscriber) => () => void;
  publish: (event: BusEvent) => void;
  subscriberCount: () => number;
}

declare global {
  var __agentEventBus: EventBus | undefined;
}

function createEventBus(): EventBus {
  const subscribers = new Set<Subscriber>();

  return {
    subscribe(fn: Subscriber) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },

    publish(event: BusEvent) {
      subscribers.forEach((fn) => {
        try { fn(event); } catch { /* subscriber disconnected */ }
      });
    },

    subscriberCount() {
      return subscribers.size;
    },
  };
}

if (!globalThis.__agentEventBus) {
  globalThis.__agentEventBus = createEventBus();
}

export const eventBus: EventBus = globalThis.__agentEventBus;
