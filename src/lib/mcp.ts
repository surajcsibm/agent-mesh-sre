/**
 * MCP (Model Context Protocol) tool registry exposed by each agent.
 *
 * Each agent runs a small MCP server with typed tool definitions.
 * Infrastructure-affecting tool calls (scale-consumers, restart-agent) are
 * marked requiresApproval=true and route through the policy gate before
 * actually executing.
 */

import type { AgentId, McpToolDefinition } from "./types";

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "intake.submitOpsRequest",
    owner: "intake-agent",
    description:
      "Accept a new operator request and publish it to ops.requests.v1.",
    inputSchema: {
      type: "object",
      required: ["kind"],
      properties: {
        kind: {
          type: "string",
          enum: [
            "lag-spike",
            "partition-imbalance",
            "controller-failover",
            "share-group-rebalance",
          ],
        },
        actor: { type: "string" },
        context: { type: "object", additionalProperties: true },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string" },
        accepted: { type: "boolean" },
      },
    },
    requiresApproval: false,
    policyTags: ["public-tool", "no-side-effects"],
  },

  {
    name: "kafka.scaleConsumers",
    owner: "monitor-agent",
    description:
      "Scale a Kafka consumer group by N replicas via the Strimzi / Event Streams Kubernetes API. Routes through StrimziCluster CRD.",
    inputSchema: {
      type: "object",
      required: ["consumerGroup", "delta"],
      properties: {
        consumerGroup: { type: "string" },
        delta: { type: "integer", minimum: -10, maximum: 10 },
        reason: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        before: { type: "integer" },
        after: { type: "integer" },
        durationMs: { type: "integer" },
      },
    },
    requiresApproval: true,
    policyTags: ["infra-mutating", "policy-gated", "audit-required", "least-privilege"],
  },

  {
    name: "kafka.acknowledgeFailover",
    owner: "monitor-agent",
    description:
      "Acknowledge a KRaft controller leadership change. No-op remediation; just records the event in the audit topic so paging humans is suppressed.",
    inputSchema: {
      type: "object",
      required: ["fromController", "toController", "epoch"],
      properties: {
        fromController: { type: "integer" },
        toController: { type: "integer" },
        epoch: { type: "integer" },
      },
    },
    outputSchema: { type: "object", properties: { acknowledged: { type: "boolean" } } },
    requiresApproval: false,
    policyTags: ["read-only-action", "audit-required"],
  },

  {
    name: "kafka.shareGroupCheckpoint",
    owner: "monitor-agent",
    description:
      "Force a checkpoint on a KIP-932 share group. Used during share-group rebalance scenarios.",
    inputSchema: {
      type: "object",
      required: ["shareGroup"],
      properties: { shareGroup: { type: "string" } },
    },
    outputSchema: { type: "object", properties: { checkpointed: { type: "boolean" } } },
    requiresApproval: true,
    policyTags: ["infra-mutating", "policy-gated", "kip-932"],
  },

  {
    name: "writer.draftIncidentReport",
    owner: "writer-agent",
    description:
      "Generate a structured post-incident report (Markdown) from an Incident record.",
    inputSchema: {
      type: "object",
      required: ["incidentId"],
      properties: { incidentId: { type: "string" } },
    },
    outputSchema: {
      type: "object",
      properties: {
        markdown: { type: "string" },
        wordCount: { type: "integer" },
      },
    },
    requiresApproval: false,
    policyTags: ["read-only-action"],
  },

  {
    name: "notify.slack",
    owner: "notification-agent",
    description: "Post the incident summary to a Slack channel.",
    inputSchema: {
      type: "object",
      required: ["channel", "title", "body"],
      properties: {
        channel: { type: "string" },
        title: { type: "string" },
        body: { type: "string" },
      },
    },
    outputSchema: { type: "object", properties: { messageTs: { type: "string" } } },
    requiresApproval: false,
    policyTags: ["egress-external", "audit-required"],
  },

  {
    name: "itsm.openTicket",
    owner: "notification-agent",
    description: "Open an ITSM ticket (ServiceNow) with the incident report attached.",
    inputSchema: {
      type: "object",
      required: ["title", "summary", "severity"],
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
      },
    },
    outputSchema: { type: "object", properties: { ticketId: { type: "string" } } },
    requiresApproval: false,
    policyTags: ["egress-external", "audit-required"],
  },
];

export function getToolsForAgent(agent: AgentId): McpToolDefinition[] {
  return MCP_TOOLS.filter((t) => t.owner === agent);
}

export function findTool(name: string): McpToolDefinition | undefined {
  return MCP_TOOLS.find((t) => t.name === name);
}
