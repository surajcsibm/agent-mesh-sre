import { triggerScenario } from "@/lib/mesh";
import { NextResponse }     from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id } = await req.json() as { id: string };
  const valid = ["lag-spike", "controller-failover", "share-group", "benign-rebalance"];
  if (!valid.includes(id)) {
    return NextResponse.json({ error: "Unknown scenario" }, { status: 400 });
  }
  const result = triggerScenario(id as Parameters<typeof triggerScenario>[0]);
  return NextResponse.json(result);
}
