/**
 * Codegen for designs produced by the workflow Builder.
 *
 * The functions here turn a `BuilderDesign` into:
 *  - a single AsyncAPI 3.0 document describing every topic edge
 *  - a multi-doc `KafkaTopic` YAML stream
 *  - a multi-doc `KafkaUser` YAML stream (one per agent, ACLs derived from
 *    each agent's consume + produce edges)
 *  - a list of validation warnings (purely advisory; nothing blocks deploy)
 *
 * Pure (no IO, no React, no `server-only`). Imported from both the Deploy
 * modal in the Builder UI and the `/api/cluster/apply` server route, so the
 * preview the user reviews and the YAML actually applied to the cluster are
 * **byte-identical**.
 */
import type { BuilderDesign } from "./builder-store";

export type ValidationResult = { ok: boolean; warnings: string[] };

export function validateDesign(d: BuilderDesign): ValidationResult {
  const warnings: string[] = [];
  if (d.agents.length === 0) warnings.push("Add at least one agent.");
  if (d.topics.length === 0) warnings.push("Connect at least two agents with a topic.");
  const seen = new Set<string>();
  for (const t of d.topics) {
    if (!t.topic || !/^[a-zA-Z0-9._-]+$/.test(t.topic)) {
      warnings.push(`Topic name “${t.topic}” has invalid characters (Kafka allows a-z 0-9 . _ -).`);
    }
    if (seen.has(t.topic)) warnings.push(`Topic name “${t.topic}” is reused on multiple edges.`);
    seen.add(t.topic);
  }
  for (const a of d.agents) {
    if (a.tools.length === 0 && a.role !== "custom") {
      warnings.push(`${a.name} has no MCP tools — add at least one to make it useful.`);
    }
  }
  return { ok: warnings.length === 0, warnings };
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function k8sName(s: string): string {
  return slug(s).slice(0, 63);
}

function yamlString(s: string): string {
  if (/^[\w \-.,'/()]+$/.test(s)) return `'${s.replace(/'/g, "''")}'`;
  return JSON.stringify(s);
}

export function buildAsyncAPI(d: BuilderDesign): string {
  const lines: string[] = [];
  lines.push(`asyncapi: '3.0.0'`);
  lines.push(`info:`);
  lines.push(`  title: ${yamlString(d.name)}`);
  lines.push(`  version: '1.0.0'`);
  if (d.description) lines.push(`  description: ${yamlString(d.description)}`);
  lines.push(`servers:`);
  lines.push(`  strimzi:`);
  lines.push(`    host: agent-mesh-kafka-kafka-bootstrap:9093`);
  lines.push(`    protocol: kafka-secure`);
  lines.push(`    description: Strimzi-managed Kafka 4.2 cluster (mTLS + SCRAM-SHA-512)`);
  lines.push(`channels:`);
  for (const t of d.topics) {
    lines.push(`  ${t.topic}:`);
    lines.push(`    address: ${t.topic}`);
    lines.push(`    description: |`);
    const src = d.agents.find((a) => a.id === t.source)?.name ?? "?";
    const dst = d.agents.find((a) => a.id === t.target)?.name ?? "?";
    lines.push(`      Edge from ${src} to ${dst}.`);
    lines.push(`      Partitions: ${t.partitions}, cleanup.policy: ${t.cleanupPolicy}, retention.ms: ${t.retentionMs}`);
    if (t.contract) lines.push(`      Contract: ${t.contract}`);
    lines.push(`    messages:`);
    lines.push(`      payload:`);
    lines.push(`        contentType: application/json`);
    lines.push(`        payload:`);
    lines.push(`          type: object`);
  }
  lines.push(`operations:`);
  for (const a of d.agents) {
    const sends = d.topics.filter((t) => t.source === a.id);
    const recvs = d.topics.filter((t) => t.target === a.id);
    for (const s of sends) {
      lines.push(`  ${slug(a.name)}-send-${slug(s.topic)}:`);
      lines.push(`    action: send`);
      lines.push(`    channel: { $ref: '#/channels/${s.topic}' }`);
    }
    for (const r of recvs) {
      lines.push(`  ${slug(a.name)}-receive-${slug(r.topic)}:`);
      lines.push(`    action: receive`);
      lines.push(`    channel: { $ref: '#/channels/${r.topic}' }`);
    }
  }
  return lines.join("\n") + "\n";
}

export type TopicManifest = {
  /** Kafka topic name. */
  topic: string;
  /** Kubernetes object name (kebab-cased, ≤63 chars). */
  name: string;
  yaml: string;
};

export function buildTopicManifests(d: BuilderDesign, namespace = "agent-mesh-sre"): TopicManifest[] {
  return d.topics.map((t) => {
    const name = k8sName(t.topic);
    const yaml = [
      `apiVersion: kafka.strimzi.io/v1`,
      `kind: KafkaTopic`,
      `metadata:`,
      `  name: ${name}`,
      `  namespace: ${namespace}`,
      `  labels:`,
      `    strimzi.io/cluster: agent-mesh-kafka`,
      `    app.kubernetes.io/part-of: agent-mesh-sre`,
      `    app.kubernetes.io/managed-by: agent-mesh-builder`,
      `spec:`,
      `  topicName: ${t.topic}`,
      `  partitions: ${t.partitions}`,
      `  replicas: 3`,
      `  config:`,
      `    cleanup.policy: ${t.cleanupPolicy}`,
      t.retentionMs >= 0
        ? `    retention.ms: '${t.retentionMs}'`
        : `    retention.ms: '-1'`,
      `    min.insync.replicas: '2'`,
    ].join("\n");
    return { topic: t.topic, name, yaml };
  });
}

export function buildTopicYaml(d: BuilderDesign, namespace = "agent-mesh-sre"): string {
  const docs = buildTopicManifests(d, namespace).map((t) => t.yaml);
  return docs.join("\n---\n") + "\n";
}

export type UserManifest = {
  /** Agent display name. */
  agent: string;
  /** Kubernetes object name (kebab-cased, ≤63 chars). */
  name: string;
  yaml: string;
};

export function buildUserManifests(d: BuilderDesign, namespace = "agent-mesh-sre"): UserManifest[] {
  return d.agents.map((a) => {
    const consumes = d.topics.filter((t) => t.target === a.id);
    const produces = d.topics.filter((t) => t.source === a.id);
    const acls: string[] = [];
    for (const t of consumes) {
      acls.push(`        - resource: { type: topic, name: ${t.topic} }`);
      acls.push(`          operations: [Describe, Read]`);
      acls.push(`          host: '*'`);
      acls.push(`        - resource: { type: group, name: ${slug(a.name)}-cg }`);
      acls.push(`          operations: [Read]`);
      acls.push(`          host: '*'`);
    }
    for (const t of produces) {
      acls.push(`        - resource: { type: topic, name: ${t.topic} }`);
      acls.push(`          operations: [Describe, Write, Create]`);
      acls.push(`          host: '*'`);
    }
    const name = k8sName(a.name);
    const yaml = [
      `apiVersion: kafka.strimzi.io/v1`,
      `kind: KafkaUser`,
      `metadata:`,
      `  name: ${name}`,
      `  namespace: ${namespace}`,
      `  labels:`,
      `    strimzi.io/cluster: agent-mesh-kafka`,
      `    app.kubernetes.io/managed-by: agent-mesh-builder`,
      `spec:`,
      `  authentication:`,
      `    type: scram-sha-512`,
      `  authorization:`,
      `    type: simple`,
      `    acls:`,
      ...(acls.length > 0 ? acls : ["        []"]),
    ].join("\n");
    return { agent: a.name, name, yaml };
  });
}

export function buildUserYaml(d: BuilderDesign, namespace = "agent-mesh-sre"): string {
  const docs = buildUserManifests(d, namespace).map((u) => u.yaml);
  return docs.join("\n---\n") + "\n";
}
