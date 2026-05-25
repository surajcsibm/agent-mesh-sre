// AsyncAPI 3.0 programmatic topic specifications.
// Source of truth for all Kafka topic shapes used by the Agent Mesh SRE runtime.
// These can be serialised to asyncapi.yaml via: JSON.stringify(ASYNCAPI_SPECS, null, 2)

export interface AsyncAPISpec {
  topicName:  string;
  asyncapi:   "3.0.0";
  info: {
    title:       string;
    version:     string;
    description: string;
  };
  channels:   Record<string, {
    address:     string;
    description: string;
    messages:    Record<string, unknown>;
  }>;
  operations: Record<string, {
    action:   "send" | "receive";
    channel:  { $ref: string };
    messages: unknown[];
  }>;
  components: {
    messages: Record<string, { payload: unknown; description: string }>;
    schemas:  Record<string, unknown>;
  };
}

export const ASYNCAPI_SPECS: AsyncAPISpec[] = [
  // ── ops.requests.v1 ──────────────────────────────────────────────────────────
  {
    topicName: "ops.requests.v1",
    asyncapi: "3.0.0",
    info: {
      title: "ops.requests.v1", version: "1.0.0",
      description: "Intake agent publishes user-initiated SRE requests. Monitor subscribes.",
    },
    channels: {
      "ops/requests/v1": {
        address: "ops.requests.v1",
        description: "6 partitions, retention 7d",
        messages: { SreRequest: { $ref: "#/components/messages/SreRequest" } },
      },
    },
    operations: {
      publishRequest: {
        action: "send",
        channel: { $ref: "#/channels/ops~1requests~1v1" },
        messages: [{ $ref: "#/channels/ops~1requests~1v1/messages/SreRequest" }],
      },
    },
    components: {
      messages: {
        SreRequest: {
          description: "Structured SRE request to the mesh.",
          payload: { $ref: "#/components/schemas/SreRequest" },
        },
      },
      schemas: {
        SreRequest: {
          type: "object",
          required: ["requestId", "requestType", "ts"],
          properties: {
            requestId:   { type: "string", format: "uuid" },
            requestType: { type: "string" },
            ts:          { type: "integer" },
            meta:        { type: "object" },
          },
        },
      },
    },
  },

  // ── ops.kafka.metrics.v1 ─────────────────────────────────────────────────────
  {
    topicName: "ops.kafka.metrics.v1",
    asyncapi: "3.0.0",
    info: {
      title: "ops.kafka.metrics.v1", version: "1.0.0",
      description: "Kafka broker and consumer-group metrics feed. Monitor reads continuously.",
    },
    channels: {
      "ops/kafka/metrics/v1": {
        address: "ops.kafka.metrics.v1",
        description: "6 partitions, retention 1d",
        messages: { MetricsSignal: { $ref: "#/components/messages/MetricsSignal" } },
      },
    },
    operations: {
      consumeMetrics: {
        action: "receive",
        channel: { $ref: "#/channels/ops~1kafka~1metrics~1v1" },
        messages: [{ $ref: "#/channels/ops~1kafka~1metrics~1v1/messages/MetricsSignal" }],
      },
    },
    components: {
      messages: {
        MetricsSignal: {
          description: "Cross-signal telemetry snapshot for Monitor reasoning.",
          payload: { $ref: "#/components/schemas/MetricsSignal" },
        },
      },
      schemas: {
        MetricsSignal: {
          type: "object",
          required: ["ts", "consumerLag", "rebalanceState"],
          properties: {
            ts:                    { type: "integer" },
            consumerGroup:         { type: "string" },
            consumerLag:           { type: "integer" },
            rebalanceState:        { type: "string" },
            controllerEpoch:       { type: "integer" },
            jvmHeapPercent:        { type: "number" },
            networkInBytesPerSec:  { type: "integer" },
            kafkaFeatureMarker:    { type: "string" },
          },
        },
      },
    },
  },

  // ── ops.incidents.v1 ────────────────────────────────────────────────────────
  {
    topicName: "ops.incidents.v1",
    asyncapi: "3.0.0",
    info: {
      title: "ops.incidents.v1", version: "1.0.0",
      description: "Monitor publishes structured incident records. Writer consumes and drafts reports.",
    },
    channels: {
      "ops/incidents/v1": {
        address: "ops.incidents.v1",
        description: "6 partitions, retention 30d, compact+delete",
        messages: { IncidentRecord: { $ref: "#/components/messages/IncidentRecord" } },
      },
    },
    operations: {
      publishIncident: {
        action: "send",
        channel: { $ref: "#/channels/ops~1incidents~1v1" },
        messages: [{ $ref: "#/channels/ops~1incidents~1v1/messages/IncidentRecord" }],
      },
      consumeIncident: {
        action: "receive",
        channel: { $ref: "#/channels/ops~1incidents~1v1" },
        messages: [{ $ref: "#/channels/ops~1incidents~1v1/messages/IncidentRecord" }],
      },
    },
    components: {
      messages: {
        IncidentRecord: {
          description: "Resolved or in-progress incident record.",
          payload: { $ref: "#/components/schemas/IncidentRecord" },
        },
      },
      schemas: {
        IncidentRecord: {
          type: "object",
          required: ["incidentId", "scenarioId", "actionTaken", "ts"],
          properties: {
            incidentId:  { type: "string" },
            scenarioId:  { type: "string" },
            rootCause:   { type: "string" },
            actionTaken: { type: "string" },
            approvedBy:  { type: "string" },
            lagBefore:   { type: "integer" },
            lagAfter:    { type: "integer" },
            ts:          { type: "integer" },
          },
        },
      },
    },
  },

  // ── ops.actions.audit.v1 ────────────────────────────────────────────────────
  {
    topicName: "ops.actions.audit.v1",
    asyncapi: "3.0.0",
    info: {
      title: "ops.actions.audit.v1", version: "1.0.0",
      description: "First-class audit trail. Every agent decision, approval, tool call, kill, and replay event. Compliance-ready.",
    },
    channels: {
      "ops/actions/audit/v1": {
        address: "ops.actions.audit.v1",
        description: "12 partitions, retention 365d, compact+delete",
        messages: { AuditRecord: { $ref: "#/components/messages/AuditRecord" } },
      },
    },
    operations: {
      publishAudit: {
        action: "send",
        channel: { $ref: "#/channels/ops~1actions~1audit~1v1" },
        messages: [{ $ref: "#/channels/ops~1actions~1audit~1v1/messages/AuditRecord" }],
      },
    },
    components: {
      messages: {
        AuditRecord: {
          description: "Durable, replayable audit record for every significant mesh event.",
          payload: { $ref: "#/components/schemas/AuditRecord" },
        },
      },
      schemas: {
        AuditRecord: {
          type: "object",
          required: ["id", "ts", "type", "agent"],
          properties: {
            id:      { type: "string" },
            ts:      { type: "integer" },
            type:    {
              type: "string",
              enum: ["consume", "publish", "tool-call", "approval",
                     "agent-kill", "agent-restart", "replay-start",
                     "replay-complete", "lesson", "notification", "reasoning"],
            },
            agent:   { type: "string" },
            topic:   { type: "string" },
            summary: { type: "string" },
            detail:  { type: "object" },
          },
        },
      },
    },
  },

  // ── ops.lessons.v1 ──────────────────────────────────────────────────────────
  {
    topicName: "ops.lessons.v1",
    asyncapi: "3.0.0",
    info: {
      title: "ops.lessons.v1", version: "1.0.0",
      description: "Monitor LEARN channel. Lesson records seed future reasoning prompts — the closed loop.",
    },
    channels: {
      "ops/lessons/v1": {
        address: "ops.lessons.v1",
        description: "3 partitions, compacted, retention indefinite",
        messages: { LessonRecord: { $ref: "#/components/messages/LessonRecord" } },
      },
    },
    operations: {
      publishLesson: {
        action: "send",
        channel: { $ref: "#/channels/ops~1lessons~1v1" },
        messages: [{ $ref: "#/channels/ops~1lessons~1v1/messages/LessonRecord" }],
      },
      consumeLesson: {
        action: "receive",
        channel: { $ref: "#/channels/ops~1lessons~1v1" },
        messages: [{ $ref: "#/channels/ops~1lessons~1v1/messages/LessonRecord" }],
      },
    },
    components: {
      messages: {
        LessonRecord: {
          description: "Outcome-based learning record. Next reasoning cites last 3 lessons.",
          payload: { $ref: "#/components/schemas/LessonRecord" },
        },
      },
      schemas: {
        LessonRecord: {
          type: "object",
          required: ["id", "ts", "actionTaken", "effective"],
          properties: {
            id:                { type: "string" },
            ts:                { type: "integer" },
            scenarioId:        { type: "string" },
            actionTaken:       { type: "string" },
            effective:         { type: "boolean" },
            lagBefore:         { type: "integer" },
            lagAfter:          { type: "integer" },
            adjustedThreshold: { type: "integer" },
            notes:             { type: "string" },
          },
        },
      },
    },
  },

  // ── ops.notifications.v1 ────────────────────────────────────────────────────
  {
    topicName: "ops.notifications.v1",
    asyncapi: "3.0.0",
    info: {
      title: "ops.notifications.v1", version: "1.0.0",
      description: "Fan-out notification records produced by the Notification agent.",
    },
    channels: {
      "ops/notifications/v1": {
        address: "ops.notifications.v1",
        description: "3 partitions, retention 7d",
        messages: { NotificationRecord: { $ref: "#/components/messages/NotificationRecord" } },
      },
    },
    operations: {
      publishNotification: {
        action: "send",
        channel: { $ref: "#/channels/ops~1notifications~1v1" },
        messages: [{ $ref: "#/channels/ops~1notifications~1v1/messages/NotificationRecord" }],
      },
    },
    components: {
      messages: {
        NotificationRecord: {
          description: "Outbound notification dispatched via Slack, ITSM, or email.",
          payload: { $ref: "#/components/schemas/NotificationRecord" },
        },
      },
      schemas: {
        NotificationRecord: {
          type: "object",
          required: ["id", "ts", "channel", "message"],
          properties: {
            id:         { type: "string" },
            ts:         { type: "integer" },
            channel:    { type: "string", enum: ["slack", "itsm", "email"] },
            message:    { type: "string" },
            scenarioId: { type: "string" },
          },
        },
      },
    },
  },
];

// Convenience lookup by topic name.
export const ASYNCAPI_SPEC_MAP = new Map(
  ASYNCAPI_SPECS.map((s) => [s.topicName, s])
);
