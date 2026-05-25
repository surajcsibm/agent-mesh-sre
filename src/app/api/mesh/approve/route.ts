import { resolveApproval } from "@/lib/mesh";
import { NextResponse }     from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id, decision, actor } = await req.json() as {
    id: string;
    decision: "approve" | "reject";
    actor?: string;
  };
  if (!id || !["approve", "reject"].includes(decision)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const ok = resolveApproval(id, decision, actor ?? "ops-engineer");
  return NextResponse.json({ ok });
}
