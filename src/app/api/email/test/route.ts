// Test route — POST /api/email/test — sends a sample summary email
import { sendAgentSummary } from "@/lib/emailer";
import { NextResponse }      from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await sendAgentSummary({
    scenarioId:    "test",
    scenarioLabel: "Email Test",
    ts:            Date.now(),
    reasoning: {
      rootCause:        "Test invocation from /api/email/test",
      confidence:       0.99,
      kafkaFeatureCited:"KIP-848",
      rebalanceState:   "stable",
      controllerEpoch:  42,
      crossCorrelation: { brokers: "all_online", jvmHeap: "68%", networkInRate: "normal", rebalanceInProgress: false },
      recommendedAction:"scale-consumers",
      requiresApproval: false,
      rationale:        "This is a test email sent from the Agent Mesh SRE test route to verify SMTP configuration.",
      lessonsCited:     ["[lag-spike] scale-consumers → effective=true, lagDelta=22800"],
    },
    action: {
      approved:   true,
      outcome:    "success",
      detail:     "Test action — no real cluster mutation performed",
      lagBefore:  24000,
      lagAfter:   1200,
      toolCalled: "kafka.scaleConsumers",
      clusterMutation: "oc scale deploy/payments-consumer --replicas=5",
    },
    lesson: {
      id: "test-lesson", ts: Date.now(),
      scenarioId: "test", actionTaken: "scale-consumers",
      effective: true, lagBefore: 24000, lagAfter: 1200,
      adjustedThreshold: 21600,
      notes: "Test lesson — threshold adjusted downward by 10% for future detection.",
    },
    slackMessage: "*Test* | Action: scale-consumers | Lag: 24,000→1,200 | Scenario: test",
    itsmTicket:   "INC-00000 opened: scale-consumers — test",
    approvedBy:   "ops-engineer",
  });

  if (result.ok) {
    return NextResponse.json({ ok: true, messageId: result.messageId });
  }
  return NextResponse.json({ ok: false, error: result.error }, { status: result.error === "smtp_not_configured" ? 501 : 500 });
}
