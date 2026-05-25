import { resetMesh }   from "@/lib/mesh";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  resetMesh();
  return NextResponse.json({ ok: true });
}
