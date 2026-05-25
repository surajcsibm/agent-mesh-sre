import { getSnapshot } from "@/lib/mesh";
import { NextResponse }  from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getSnapshot());
}
