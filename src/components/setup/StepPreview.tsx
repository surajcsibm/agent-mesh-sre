"use client";

import { ArrowRight, Boxes, Cpu, Layers, Lock, ShieldCheck, Users, Zap } from "lucide-react";

const PREVIEW = [
  {
    icon: <Cpu size={14} />,
    title: "Kafka cluster",
    detail: "agent-mesh-kafka — Kafka 4.2.0 (KRaft, IV1), Cruise Control",
    facts: ["3 controllers", "3 brokers", "JBOD persistent"],
  },
  {
    icon: <Boxes size={14} />,
    title: "KafkaNodePools",
    detail: "split controller / broker pools (KIP-848 / KIP-932 enabled)",
    facts: ["controller × 3", "broker × 3"],
  },
  {
    icon: <Lock size={14} />,
    title: "Listeners",
    detail: "Internal TLS + SASL/SCRAM-SHA-512, external Route + SCRAM",
    facts: ["mTLS internal", "SCRAM external"],
  },
  {
    icon: <Layers size={14} />,
    title: "KafkaTopics",
    detail: "6 ops topics + 1 demo data-plane topic — full AsyncAPI 3.0 coverage",
    facts: ["ops.requests.v1", "ops.kafka.metrics.v1", "ops.lessons.v1 (compact)", "ops.incidents.v1", "ops.actions.audit.v1 (1y)", "ops.notifications.v1", "demo.payments.events"],
  },
  {
    icon: <Users size={14} />,
    title: "KafkaUsers",
    detail: "one identity per agent + a controller user for the demo app",
    facts: ["intake-agent", "monitor-agent", "writer-agent", "notification-agent", "agent-mesh-controller", "demo-workload"],
  },
  {
    icon: <Zap size={14} />,
    title: "Demo workloads",
    detail: "real producers/consumers the scenario buttons will manipulate",
    facts: ["fast-producer", "slow-consumer", "cooperative-consumer", "share-group-consumer"],
  },
  {
    icon: <ShieldCheck size={14} />,
    title: "Authorization",
    detail: "type=simple ACLs, scoped per agent identity (least privilege)",
    facts: ["per-agent ACLs", "topic + group + cluster grants"],
  },
];

export function StepPreview({ onBack, onApply }: { onBack: () => void; onApply: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PREVIEW.map((p) => (
          <div key={p.title} className="rounded-xl border border-white/10 bg-bg-elev/40 p-4">
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, rgba(34,211,238,0.18), rgba(167,139,250,0.18))",
                  border: "1px solid rgba(167,139,250,0.32)",
                  color: "#a78bfa",
                }}
              >
                {p.icon}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-fg-base">{p.title}</div>
                <div className="text-[11.5px] text-fg-muted leading-relaxed mt-0.5">{p.detail}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.facts.map((f) => (
                    <span
                      key={f}
                      className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-white/5 text-fg-base border border-white/10"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-[12.5px]">
        <div className="text-cyan-200 font-medium mb-1">What happens when you click Apply</div>
        <ul className="text-fg-muted leading-relaxed list-disc list-inside space-y-0.5">
          <li>Manifests are server-side applied as <code className="text-cyan-100">agent-mesh-sre</code> field manager. Idempotent: rerunning is safe.</li>
          <li>The wizard streams progress per resource via Server-Sent Events.</li>
          <li>Once <code>Kafka/agent-mesh-kafka</code> reports <code>Ready=True</code>, the wizard reads the bootstrap, CA cert, and SCRAM password and switches the demo to <strong>real cluster</strong> mode.</li>
        </ul>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-3.5 py-2 rounded-md text-[12.5px] bg-white/5 hover:bg-white/10 border border-white/10 text-fg-base transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onApply}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold transition-all"
          style={{
            background: "linear-gradient(135deg, rgba(34, 211, 238, 0.25), rgba(167, 139, 250, 0.25))",
            border: "1px solid rgba(167,139,250,0.5)",
            color: "#fff",
            boxShadow: "0 0 24px rgba(167,139,250,0.25)",
          }}
        >
          Apply manifests & wait for Ready
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
