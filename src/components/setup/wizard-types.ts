/**
 * Shared types for the Setup Wizard. Mirrors the SSE payloads emitted by
 * /api/cluster/install. Defined here so client components don't import
 * server-only modules.
 */

export type WizardStepId = "namespace" | "nodepools" | "cluster" | "topics" | "users" | "workloads" | "ready-kafka" | "credentials";

export type ApplyResult = {
  group: string;
  version: string;
  kind: string;
  namespace?: string;
  name: string;
  action: "created" | "updated" | "unchanged" | "skipped" | "error";
  message?: string;
};

export type WizardStep = { id: WizardStepId; file: string; description: string };

export type StepEvent =
  | { kind: "step"; step: WizardStep; phase: "applying"; startedAt: number }
  | { kind: "step"; step: WizardStep; phase: "applied"; applyResults: ApplyResult[]; durationMs: number }
  | { kind: "step"; step: WizardStep; phase: "waiting"; startedAt: number }
  | { kind: "step"; step: WizardStep; phase: "ready" | "error"; ready?: boolean; message?: string }
  | { kind: "snapshot"; snapshot: unknown }
  | { kind: "credentials"; credentials: { bootstrapInternal?: string; bootstrapExternal?: string; username?: string; hasPassword: boolean; hasCaCert: boolean } }
  | { kind: "done"; ok: boolean }
  | { kind: "error"; error: string };

export type StepState = {
  step: WizardStep;
  phase: "pending" | "applying" | "applied" | "waiting" | "ready" | "error";
  startedAt?: number;
  finishedAt?: number;
  applyResults?: ApplyResult[];
  message?: string;
};

export const ORDERED_STEPS: WizardStep[] = [
  { id: "namespace", file: "00-namespace.yaml", description: "Namespace agent-mesh-sre" },
  { id: "nodepools", file: "01-kafka-nodepools.yaml", description: "KafkaNodePools (controller + broker, KRaft)" },
  { id: "cluster", file: "02-kafka-cluster.yaml", description: "Kafka cluster (4.2.0, mTLS + SCRAM, KIP-848 + KIP-932)" },
  { id: "topics", file: "03-kafka-topics.yaml", description: "KafkaTopics (ops.* + demo.payments.events)" },
  { id: "users", file: "04-kafka-users.yaml", description: "KafkaUsers (per-agent SCRAM + ACLs)" },
  { id: "workloads", file: "05-demo-workloads.yaml", description: "Demo producer/consumer workloads" },
  { id: "ready-kafka", file: "", description: "Wait for Kafka cluster Ready" },
  { id: "credentials", file: "", description: "Read credentials" },
];
