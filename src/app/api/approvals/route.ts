import { NextResponse } from "next/server";
import { getMesh } from "@/lib/mesh";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    decision?: "approved" | "rejected";
    actor?: string;
  };
  if (!body.id || (body.decision !== "approved" && body.decision !== "rejected")) {
    return NextResponse.json({ error: "id and decision (approved|rejected) required" }, { status: 400 });
  }
  const mesh = getMesh();
  const decision = body.decision === "approved" ? "approve" : "reject";
  mesh.decideApproval(body.id, decision, body.actor ?? "operator@stage");
  return NextResponse.json({ ok: true });
}
