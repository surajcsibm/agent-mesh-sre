// POST /api/notify — sends a scenario summary email (approved OR rejected).
// Called by the client-side simulation so email works on Vercel
// (where the server-side mesh singleton is isolated per instance).
import { sendAgentSummary } from "@/lib/emailer";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as {
    scenarioId?: string;
    scenarioLabel?: string;
    action?: string;
    lagBefore?: number;
    lagAfter?: number;
    approvedBy?: string;
    approved?: boolean;
    reasoning?: {
      rootCause: string;
      confidence: number;
      kafkaFeature: string;
      rationale: string;
      lessonsCited?: string[];
    };
    lesson?: {
      notes: string;
      adjustedThreshold?: number;
    };
    slackMessage?: string;
    itsmTicket?: string;
    liveEvents?: Array<{ type: string; agent: string; summary: string; ts: number }>;
  };

  const scenarioId    = body.scenarioId    ?? "demo";
  const scenarioLabel = body.scenarioLabel ?? "Demo Scenario";
  const lagBefore     = body.lagBefore     ?? 0;
  const lagAfter      = body.lagAfter      ?? 0;
  const approvedBy    = body.approvedBy    ?? "operator";
  const actionTaken   = body.action        ?? "kafka.scaleConsumers";
  const approved      = body.approved      !== false; // default true

  // Use passed reasoning or generate a sensible default
  const r = body.reasoning;

  const result = await sendAgentSummary({ liveEvents: body.liveEvents,
    scenarioId,
    scenarioLabel,
    ts: Date.now(),
    reasoning: {
      rootCause:         r?.rootCause         ?? `Incident detected (${lagBefore} msgs behind)`,
      confidence:        r?.confidence        ?? 0.90,
      kafkaFeatureCited: r?.kafkaFeature      ?? "Kafka",
      rebalanceState:    "Rebalancing",
      controllerEpoch:   14,
      crossCorrelation: {
        brokers: "healthy", jvmHeap: "68%",
        networkInRate: "↑ 2.1×", rebalanceInProgress: true,
      },
      recommendedAction: actionTaken,
      requiresApproval:  true,
      rationale:         r?.rationale         ?? `${actionTaken} was proposed to resolve the incident.`,
      lessonsCited:      r?.lessonsCited       ?? [],
    },
    action: approved ? {
      approved:        true,
      approvedBy,
      outcome:         "success",
      detail:          `${actionTaken} executed successfully — lag ${lagBefore}→${lagAfter}`,
      lagBefore,
      lagAfter,
      toolCalled:      actionTaken,
      clusterMutation: "ConsumerGroupScaleOut",
    } : {
      approved:        false,
      approvedBy,
      outcome:         "rejected",
      detail:          `${actionTaken} was rejected by operator — no cluster changes made`,
      lagBefore,
      lagAfter,
      toolCalled:      actionTaken,
    },
    lesson: approved && body.lesson ? {
      id:                `lesson-${Date.now()}`,
      ts:                Date.now(),
      scenarioId,
      actionTaken,
      effective:         true,
      lagBefore,
      lagAfter,
      adjustedThreshold: body.lesson.adjustedThreshold,
      notes:             body.lesson.notes,
    } : null,
    slackMessage: body.slackMessage ?? `*${scenarioLabel}* | ${approved ? "✅ Resolved" : "🚫 Rejected"} | Action: ${actionTaken}`,
    itsmTicket:   body.itsmTicket   ?? `INC-${Date.now().toString().slice(-5)}: ${actionTaken} — ${scenarioId}`,
    approvedBy,
  });

  if (result.ok) {
    return NextResponse.json({ ok: true, messageId: result.messageId });
  }
  return NextResponse.json(
    { ok: false, error: result.error },
    { status: result.error === "smtp_not_configured" ? 501 : 500 }
  );
}
