/**
 * AsyncAPI 3.0 channel contracts for every Kafka topic in the mesh.
 *
 * The proposal calls out: "Every Kafka topic is governed by an AsyncAPI 3.0
 * specification ... giving agents machine-readable channel contracts they can
 * self-discover and validate against a schema registry."
 *
 * These are real, valid AsyncAPI 3.0 fragments - one per topic. The viewer
 * panel renders them when the user clicks an edge on the canvas.
 */

import type { TopicName } from "./types";

export interface AsyncApiChannelSpec {
  asyncapi: "3.0.0";
  info: { title: string; version: string; description: string };
  servers: Record<string, { host: string; protocol: string; description: string }>;
  channels: Record<string, unknown>;
  operations: Record<string, unknown>;
  components: { messages: Record<string, unknown>; schemas: Record<string, unknown> };
}

const SERVER = {
  "kafka-prod": {
    host: "events.acme.internal:9093",
    protocol: "kafka-secure",
    description: "Kafka 4.x cluster (KRaft mode) with SASL/SCRAM + mTLS",
  },
};

export const ASYNCAPI_SPECS: Record<TopicName, AsyncApiChannelSpec> = {
  "ops.requests.v1": {
    asyncapi: "3.0.0",
    info: {
      title: "Ops Requests",
      version: "1.0.0",
      description:
        "Operator/user requests entering the mesh via the Intake Agent's MCP tool call.",
    },
    servers: SERVER,
    channels: {
      "ops.requests.v1": {
        address: "ops.requests.v1",
        messages: { OpsRequest: { $ref: "#/components/messages/OpsRequest" } },
        bindings: { kafka: { topicConfiguration: { partitions: 3, "cleanup.policy": ["delete"] } } },
      },
    },
    operations: {
      receiveOpsRequest: {
        action: "receive",
        channel: { $ref: "#/channels/ops.requests.v1" },
        summary: "Intake agent consumes operator-driven requests.",
      },
    },
    components: {
      messages: {
        OpsRequest: {
          name: "OpsRequest",
          contentType: "application/json",
          payload: { $ref: "#/components/schemas/OpsRequest" },
        },
      },
      schemas: {
        OpsRequest: {
          type: "object",
          required: ["requestId", "kind", "createdAt"],
          properties: {
            requestId: { type: "string", format: "uuid" },
            kind: { type: "string", enum: ["lag-spike", "partition-imbalance", "controller-failover", "share-group-rebalance"] },
            actor: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            context: { type: "object", additionalProperties: true },
          },
        },
      },
    },
  },

  "ops.kafka.metrics.v1": {
    asyncapi: "3.0.0",
    info: {
      title: "Kafka Metrics Stream",
      version: "1.2.0",
      description:
        "Metric signals (lag, ISR, rebalance state, KRaft controller epoch, share-group offsets) for the Monitor Agent.",
    },
    servers: SERVER,
    channels: {
      "ops.kafka.metrics.v1": {
        address: "ops.kafka.metrics.v1",
        messages: { MetricsSignal: { $ref: "#/components/messages/MetricsSignal" } },
        bindings: { kafka: { topicConfiguration: { partitions: 6, "cleanup.policy": ["compact"] } } },
      },
    },
    operations: {
      streamMetrics: {
        action: "receive",
        channel: { $ref: "#/channels/ops.kafka.metrics.v1" },
        summary: "Monitor agent consumes metric signals from broker JMX + Kubernetes telemetry.",
      },
    },
    components: {
      messages: {
        MetricsSignal: {
          name: "MetricsSignal",
          contentType: "application/json",
          payload: { $ref: "#/components/schemas/MetricsSignal" },
        },
      },
      schemas: {
        MetricsSignal: {
          type: "object",
          required: ["brokerId", "topic", "consumerGroup", "lagMessages", "rebalanceState", "controllerEpoch"],
          properties: {
            brokerId: { type: "integer" },
            topic: { type: "string" },
            partition: { type: "integer" },
            consumerGroup: { type: "string" },
            lagMessages: { type: "integer", minimum: 0 },
            isrCount: { type: "integer", minimum: 0 },
            rebalanceState: { type: "string", enum: ["stable", "preparing-rebalance", "completing-rebalance", "share-group-assigning"] },
            controllerEpoch: { type: "integer" },
            jvmHeapPercent: { type: "number" },
            podCpuPercent: { type: "number" },
            kafkaFeature: { type: "string", enum: ["KRaft", "KIP-848", "KIP-932", "classic"] },
          },
        },
      },
    },
  },

  "ops.incidents.v1": {
    asyncapi: "3.0.0",
    info: {
      title: "Ops Incidents",
      version: "1.0.0",
      description: "Incident records emitted by the Monitor Agent after a reasoning step.",
    },
    servers: SERVER,
    channels: {
      "ops.incidents.v1": {
        address: "ops.incidents.v1",
        messages: { Incident: { $ref: "#/components/messages/Incident" } },
        bindings: { kafka: { topicConfiguration: { partitions: 3, "cleanup.policy": ["delete"] } } },
      },
    },
    operations: {
      publishIncident: {
        action: "send",
        channel: { $ref: "#/channels/ops.incidents.v1" },
        summary: "Monitor agent publishes incidents that the Writer agent will draft up.",
      },
    },
    components: {
      messages: {
        Incident: {
          name: "Incident",
          contentType: "application/json",
          payload: { $ref: "#/components/schemas/Incident" },
        },
      },
      schemas: {
        Incident: {
          type: "object",
          required: ["id", "severity", "title", "reasoning"],
          properties: {
            id: { type: "string", format: "uuid" },
            severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
            title: { type: "string" },
            summary: { type: "string" },
            signal: { $ref: "#/components/schemas/MetricsSignalRef" },
            reasoning: { type: "object", additionalProperties: true },
            action: { type: "object", additionalProperties: true },
          },
        },
        MetricsSignalRef: { type: "object", additionalProperties: true },
      },
    },
  },

  "ops.actions.audit.v1": {
    asyncapi: "3.0.0",
    info: {
      title: "Action Audit Trail",
      version: "1.0.0",
      description:
        "First-class audit topic - every agent decision and tool call is published here. Durable, replayable, compliance-ready.",
    },
    servers: SERVER,
    channels: {
      "ops.actions.audit.v1": {
        address: "ops.actions.audit.v1",
        messages: { AuditEntry: { $ref: "#/components/messages/AuditEntry" } },
        bindings: { kafka: { topicConfiguration: { partitions: 3, "cleanup.policy": ["compact", "delete"], "retention.ms": 31536000000 } } },
      },
    },
    operations: {
      auditWrite: {
        action: "send",
        channel: { $ref: "#/channels/ops.actions.audit.v1" },
        summary: "All MCP tool calls + approval decisions written to immutable audit log.",
      },
    },
    components: {
      messages: {
        AuditEntry: {
          name: "AuditEntry",
          contentType: "application/json",
          payload: { $ref: "#/components/schemas/AuditEntry" },
        },
      },
      schemas: {
        AuditEntry: {
          type: "object",
          required: ["id", "ts", "agent", "kind", "detail"],
          properties: {
            id: { type: "string" },
            ts: { type: "integer", format: "int64" },
            agent: { type: "string" },
            kind: { type: "string", enum: ["tool-call", "approval-decision", "publish", "consume", "commit-offset", "agent-kill", "agent-restart", "replay-start", "replay-complete"] },
            detail: { type: "string" },
            meta: { type: "object", additionalProperties: true },
          },
        },
      },
    },
  },

  "ops.lessons.v1": {
    asyncapi: "3.0.0",
    info: {
      title: "Lessons Learned",
      version: "1.0.0",
      description:
        "The 'Learn' phase output: each completed remediation publishes lag-before/after, effectiveness, and threshold adjustment. Future reasoning prompts are seeded with the last N entries from this topic.",
    },
    servers: SERVER,
    channels: {
      "ops.lessons.v1": {
        address: "ops.lessons.v1",
        messages: { Lesson: { $ref: "#/components/messages/Lesson" } },
        bindings: { kafka: { topicConfiguration: { partitions: 1, "cleanup.policy": ["compact"] } } },
      },
    },
    operations: {
      writeLesson: {
        action: "send",
        channel: { $ref: "#/channels/ops.lessons.v1" },
        summary: "Monitor agent publishes a Lesson 60s after each Act, which feeds back into the next Reason prompt.",
      },
    },
    components: {
      messages: {
        Lesson: {
          name: "Lesson",
          contentType: "application/json",
          payload: { $ref: "#/components/schemas/Lesson" },
        },
      },
      schemas: {
        Lesson: {
          type: "object",
          required: ["id", "ts", "actionTaken", "lagBefore", "lagAfter", "effective"],
          properties: {
            id: { type: "string" },
            ts: { type: "integer" },
            scenario: { type: "string" },
            actionTaken: { type: "string" },
            effective: { type: "boolean" },
            lagBefore: { type: "integer" },
            lagAfter: { type: "integer" },
            adjustedThreshold: { type: "integer" },
            notes: { type: "string" },
          },
        },
      },
    },
  },

  "ops.notifications.v1": {
    asyncapi: "3.0.0",
    info: {
      title: "Operator Notifications",
      version: "1.0.0",
      description: "Slack + ITSM ticket payloads emitted by the Notification Agent at the end of the closed loop.",
    },
    servers: SERVER,
    channels: {
      "ops.notifications.v1": {
        address: "ops.notifications.v1",
        messages: { Notification: { $ref: "#/components/messages/Notification" } },
        bindings: { kafka: { topicConfiguration: { partitions: 1 } } },
      },
    },
    operations: {
      publishNotification: {
        action: "send",
        channel: { $ref: "#/channels/ops.notifications.v1" },
      },
    },
    components: {
      messages: {
        Notification: {
          name: "Notification",
          contentType: "application/json",
          payload: { $ref: "#/components/schemas/Notification" },
        },
      },
      schemas: {
        Notification: {
          type: "object",
          required: ["id", "channel", "title", "body"],
          properties: {
            id: { type: "string" },
            channel: { type: "string", enum: ["slack", "itsm", "email"] },
            title: { type: "string" },
            body: { type: "string" },
            link: { type: "string", format: "uri" },
          },
        },
      },
    },
  },
};

/**
 * Convenience: which topic connects two agents (for the canvas edge labels).
 */
export const EDGE_TOPIC: Record<string, TopicName> = {
  "intake-agent->monitor-agent": "ops.requests.v1",
  "monitor-agent->writer-agent": "ops.incidents.v1",
  "writer-agent->notification-agent": "ops.actions.audit.v1",
  "monitor-agent->monitor-agent": "ops.lessons.v1",
  "broker->monitor-agent": "ops.kafka.metrics.v1",
  "notification-agent->external": "ops.notifications.v1",
};
