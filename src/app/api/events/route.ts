import { getMesh } from "@/lib/mesh";
import { getEventBus } from "@/lib/event-bus";
import type { BusEvent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const mesh = getMesh();
  const bus  = getEventBus();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (e: BusEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          // controller closed
        }
      };

      // 1) initial snapshot
      send({ type: "state", ...mesh.getSnapshot() } as unknown as BusEvent);

      // 2) live updates
      const unsubscribe = bus.subscribe(send);

      // 3) heartbeat
      const beat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(beat);
          unsubscribe();
        }
      }, 15_000);

      void beat;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-transform",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
