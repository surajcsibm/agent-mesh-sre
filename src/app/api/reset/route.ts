import { NextResponse } from "next/server";
import { getMesh } from "@/lib/mesh";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  getMesh().reset();
  return NextResponse.json({ ok: true });
}
