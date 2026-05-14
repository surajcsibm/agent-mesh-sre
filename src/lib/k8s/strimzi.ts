/**
 * High-level Strimzi orchestration. Knows the install ordering, where the
 * deploy/base manifests live on disk, and how to wait for each Strimzi CR
 * to report a Ready status condition.
 *
 * Invoked from the /api/cluster/* routes and the Setup Wizard UI.
 */
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import {
  ApplyResult,
  K8sClient,
  KafkaCondition,
  KafkaResource,
  KafkaTopicResource,
  KafkaUserResource,
  KafkaNodePoolResource,
  isReady,
} from "./client";

export type InstallStep =
  | { id: "namespace"; file: "00-namespace.yaml"; description: string }
  | { id: "nodepools"; file: "01-kafka-nodepools.yaml"; description: string }
  | { id: "cluster"; file: "02-kafka-cluster.yaml"; description: string }
  | { id: "topics"; file: "03-kafka-topics.yaml"; description: string }
  | { id: "users"; file: "04-kafka-users.yaml"; description: string }
  | { id: "workloads"; file: "05-demo-workloads.yaml"; description: string };

export const INSTALL_STEPS: InstallStep[] = [
  { id: "namespace", file: "00-namespace.yaml", description: "Namespace agent-mesh-sre" },
  { id: "nodepools", file: "01-kafka-nodepools.yaml", description: "KafkaNodePools (controller + broker, KRaft)" },
  { id: "cluster", file: "02-kafka-cluster.yaml", description: "Kafka cluster (4.2.0, mTLS + SCRAM, KIP-848 + KIP-932)" },
  { id: "topics", file: "03-kafka-topics.yaml", description: "KafkaTopics (ops.* + demo.payments.events)" },
  { id: "users", file: "04-kafka-users.yaml", description: "KafkaUsers (per-agent SCRAM + ACLs)" },
  { id: "workloads", file: "05-demo-workloads.yaml", description: "Demo producer/consumer workloads" },
];

export type StepProgress = {
  step: InstallStep;
  phase: "applying" | "applied" | "waiting" | "ready" | "error";
  applyResults?: ApplyResult[];
  ready?: boolean;
  message?: string;
  startedAt: number;
  finishedAt?: number;
};

export type ClusterConfig = {
  namespace: string;
  cluster: string;
  manifestDir?: string;
};

export const DEFAULT_CONFIG: ClusterConfig = {
  namespace: "agent-mesh-sre",
  cluster: "agent-mesh-kafka",
};

function manifestRoot(cfg: ClusterConfig): string {
  return cfg.manifestDir ?? path.join(process.cwd(), "deploy", "base");
}

export async function readStepYaml(step: InstallStep, cfg: ClusterConfig): Promise<string> {
  const file = path.join(manifestRoot(cfg), step.file);
  return fs.readFile(file, "utf8");
}

export type SnapshotEntry = {
  kind: string;
  name: string;
  ready: boolean;
  reason?: string;
  message?: string;
};

export type ClusterSnapshot = {
  fetchedAt: string;
  cluster: {
    name: string;
    namespace: string;
    exists: boolean;
    ready: boolean;
    kafkaVersion?: string;
    metadataVersion?: string;
    kafkaListeners: { name: string; bootstrap?: string }[];
    conditions: KafkaCondition[];
    clusterId?: string;
  };
  nodePools: SnapshotEntry[];
  topics: SnapshotEntry[];
  users: SnapshotEntry[];
  totals: { topics: number; users: number; nodePools: number };
};

/** Get a complete one-shot snapshot of the cluster's CR state. */
export async function snapshotCluster(
  client: K8sClient,
  cfg: ClusterConfig = DEFAULT_CONFIG
): Promise<ClusterSnapshot> {
  const ns = cfg.namespace;
  const [kafka, topics, users, nodePools] = await Promise.all([
    client.getKafka(cfg.cluster, ns).catch(() => null) as Promise<KafkaResource | null>,
    client.listKafkaTopics(ns).catch(() => [] as KafkaTopicResource[]),
    client.listKafkaUsers(ns).catch(() => [] as KafkaUserResource[]),
    client.listKafkaNodePools(ns).catch(() => [] as KafkaNodePoolResource[]),
  ]);

  return {
    fetchedAt: new Date().toISOString(),
    cluster: {
      name: cfg.cluster,
      namespace: ns,
      exists: !!kafka,
      ready: isReady(kafka?.status?.conditions),
      kafkaVersion: kafka?.status?.kafkaVersion ?? kafka?.spec?.kafka?.version,
      metadataVersion: kafka?.status?.kafkaMetadataVersion,
      kafkaListeners: (kafka?.status?.listeners ?? []).map((l) => ({
        name: l.name,
        bootstrap: l.bootstrapServers,
      })),
      conditions: kafka?.status?.conditions ?? [],
      clusterId: kafka?.status?.clusterId,
    },
    nodePools: nodePools.map((p) => entry(p, "KafkaNodePool")),
    topics: topics.map((t) => entry(t, "KafkaTopic")),
    users: users.map((u) => entry(u, "KafkaUser")),
    totals: { topics: topics.length, users: users.length, nodePools: nodePools.length },
  };
}

function entry(
  res: { metadata?: { name?: string }; status?: { conditions?: KafkaCondition[] } },
  kind: string
): SnapshotEntry {
  const r = readyOf(res.status?.conditions);
  return {
    kind,
    name: res.metadata?.name ?? "?",
    ready: r.ready,
    reason: r.reason,
    message: r.message,
  };
}

function readyOf(conditions?: KafkaCondition[]) {
  const ready = conditions?.find((c) => c.type === "Ready");
  return {
    ready: ready?.status === "True",
    reason: ready?.reason,
    message: ready?.message,
  };
}

/** Apply one install step. Returns the apply outcome (no waiting). */
export async function applyStep(
  client: K8sClient,
  step: InstallStep,
  cfg: ClusterConfig = DEFAULT_CONFIG
): Promise<ApplyResult[]> {
  const yamlText = await readStepYaml(step, cfg);
  return client.applyYaml(yamlText, "agent-mesh-sre");
}

/**
 * Wait for a CR to reach Ready=True (or fail). Polls every `pollMs`.
 * `getResource` returns the latest object or null if missing.
 */
export async function waitForReady<T extends { status?: { conditions?: KafkaCondition[] } }>(
  getResource: () => Promise<T | null>,
  opts: { timeoutMs?: number; pollMs?: number; signal?: AbortSignal } = {}
): Promise<{ ready: boolean; message?: string }> {
  const timeoutMs = opts.timeoutMs ?? 600_000;
  const pollMs = opts.pollMs ?? 2_500;
  const start = Date.now();
  while (true) {
    if (opts.signal?.aborted) return { ready: false, message: "aborted" };
    const r = await getResource();
    if (r) {
      const cond = r.status?.conditions?.find((c) => c.type === "Ready");
      if (cond?.status === "True") return { ready: true };
      const not = r.status?.conditions?.find((c) => c.type === "NotReady");
      if (not?.status === "True") return { ready: false, message: not.message ?? not.reason };
    }
    if (Date.now() - start > timeoutMs) return { ready: false, message: "timeout" };
    await new Promise((res) => setTimeout(res, pollMs));
  }
}

/**
 * Read the connection details out of the cluster: bootstrap + cluster CA cert
 * + the password for the agent-mesh-controller user. Used by the Setup Wizard
 * to seed the local app's runtime config without the user copying secrets.
 */
export async function readControllerCredentials(
  client: K8sClient,
  cfg: ClusterConfig = DEFAULT_CONFIG,
  username = "agent-mesh-controller"
): Promise<{
  bootstrapInternal?: string;
  bootstrapExternal?: string;
  caCertPem?: string;
  username: string;
  password?: string;
}> {
  const kafka = await client.getKafka(cfg.cluster, cfg.namespace);
  const listeners = kafka?.status?.listeners ?? [];
  const bootstrapInternal = listeners.find((l) => l.name === "tls")?.bootstrapServers;
  const bootstrapExternal = listeners.find((l) => l.name === "external")?.bootstrapServers;

  const caSecret = await client.getSecretData(`${cfg.cluster}-cluster-ca-cert`, cfg.namespace);
  const caCertPem = caSecret?.["ca.crt"]?.toString("utf8");

  const userSecret = await client.getSecretData(username, cfg.namespace);
  const password = userSecret?.["password"]?.toString("utf8");

  return { bootstrapInternal, bootstrapExternal, caCertPem, username, password };
}
