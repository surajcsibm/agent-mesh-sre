import { NextResponse } from "next/server";
import { MCP_TOOLS } from "@/lib/mcp";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  // Wrapped in a JSON-RPC-style "tools/list" envelope for authenticity
  return NextResponse.json({
    jsonrpc: "2.0",
    id: 1,
    result: { tools: MCP_TOOLS },
  });
}
