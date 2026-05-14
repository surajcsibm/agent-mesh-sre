import { NextResponse } from "next/server";
import { ASYNCAPI_SPECS } from "@/lib/asyncapi";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return NextResponse.json(ASYNCAPI_SPECS);
}
