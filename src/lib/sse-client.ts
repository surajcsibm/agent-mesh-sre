"use client";

import { useEffect } from "react";
import { useMesh } from "./store";
import type { WireEvent } from "./types";

export function useMeshStream(): void {
  const applyEvent = useMesh((s) => s.applyEvent);
  const setConnected = useMesh((s) => s.setConnected);
  const pruneParticles = useMesh((s) => s.pruneParticles);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data) as WireEvent;
        applyEvent(ev);
      } catch {
        // malformed
      }
    };
    return () => es.close();
  }, [applyEvent, setConnected]);

  // Garbage-collect particle list periodically
  useEffect(() => {
    const i = setInterval(pruneParticles, 600);
    return () => clearInterval(i);
  }, [pruneParticles]);
}

export async function postJson(url: string, body: unknown): Promise<unknown> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}
