import { NextResponse } from "next/server";
import { getMesh } from "@/lib/mesh";
import type { AgentId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID: AgentId[] = ["intake-agent", "monitor-agent", "writer-agent", "notification-agent"];

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { id?: AgentId; op?: "kill" | "restart" };
  if (!body.id || !VALID.includes(body.id) || (body.op !== "kill" && body.op !== "restart")) {
    return NextResponse.json({ error: "id and op (kill|restart) required" }, { status: 400 });
  }
  const mesh = getMesh();
  if (body.op === "kill") mesh.killAgent(body.id);
  else mesh.restartAgent(body.id);
  return NextResponse.json({ ok: true });
}
