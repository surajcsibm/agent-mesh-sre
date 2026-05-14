/**
 * GET  /api/cluster/mode — public view of the runtime config.
 * POST /api/cluster/mode — explicitly switch mode (mock|real).
 */
import { NextRequest, NextResponse } from "next/server";
import { AppMode, publicView, setMode } from "@/lib/runtime-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(publicView());
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { mode?: AppMode };
  if (body.mode !== "mock" && body.mode !== "real") {
    return NextResponse.json({ ok: false, error: "mode must be 'mock' or 'real'" }, { status: 400 });
  }
  setMode(body.mode);
  return NextResponse.json({ ok: true, runtime: publicView() });
}
