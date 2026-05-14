/**
 * Server-Sent Events stream of every WireEvent published by the mesh.
 *
 * Clients connect once on page load and receive an initial "snapshot" event
 * followed by an unbounded stream of incremental events. The connection
 * stays open as long as the browser tab is open.
 */
import { getMesh } from "@/lib/mesh";
import { getEventBus } from "@/lib/event-bus";
import type { WireEvent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const mesh = getMesh();
  const bus = getEventBus();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (e: WireEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          // controller closed
        }
      };

      // 1) initial snapshot
      send({ kind: "snapshot", payload: mesh.snapshot() });

      // 2) live updates
      const unsubscribe = bus.subscribe(send);

      // 3) heartbeat to keep the connection alive across proxies
      const beat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(beat);
          unsubscribe();
        }
      }, 15_000);

      const close = () => {
        clearInterval(beat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      // Detach when client disconnects
      // (controller does not expose 'closed' directly; we rely on enqueue throwing)
      void close;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
