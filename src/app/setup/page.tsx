"use client";

import { useState } from "react";
import { WizardChrome } from "@/components/setup/WizardChrome";
import { StepConnect } from "@/components/setup/StepConnect";
import { StepPreview } from "@/components/setup/StepPreview";
import { StepInstall } from "@/components/setup/StepInstall";
import { StepDone } from "@/components/setup/StepDone";

type Stage = "connect" | "preview" | "install" | "done";

const TITLES: Record<Stage, { title: string; subtitle: string; index: number }> = {
  connect: {
    title: "Connect to your OpenShift cluster",
    subtitle:
      "We use your local kubeconfig (or in-cluster ServiceAccount when this app runs in the cluster) to verify access to the Kubernetes API and confirm the Strimzi 0.51.0 operator is installed.",
    index: 1,
  },
  preview: {
    title: "Review what will be applied",
    subtitle:
      "The wizard installs a complete Strimzi-managed Kafka 4.2 cluster (KRaft, mTLS, SCRAM, KIP-848, KIP-932) plus the AsyncAPI-governed topics, per-agent KafkaUsers with scoped ACLs, and the demo workloads the scenario buttons will drive.",
    index: 2,
  },
  install: {
    title: "Applying manifests and waiting for Ready",
    subtitle:
      "Each step is server-side applied, then the wizard watches Strimzi reconcile until the Kafka CR reports Ready=True. This typically takes 2–4 minutes on a fresh cluster.",
    index: 3,
  },
  done: {
    title: "Cluster ready — demo is live on real Kafka",
    subtitle:
      "Real producers, real consumers, real KRaft controllers, real mTLS + SCRAM, real ACLs. Scenario buttons now mutate the real cluster.",
    index: 4,
  },
};

type Creds = Parameters<typeof StepDone>[0]["creds"];

export default function SetupPage() {
  const [stage, setStage] = useState<Stage>("connect");
  const [creds, setCreds] = useState<Creds>(null);

  const meta = TITLES[stage];

  return (
    <WizardChrome step={meta.index} total={4} title={meta.title} subtitle={meta.subtitle}>
      {stage === "connect" && <StepConnect onContinue={() => setStage("preview")} />}
      {stage === "preview" && (
        <StepPreview onBack={() => setStage("connect")} onApply={() => setStage("install")} />
      )}
      {stage === "install" && (
        <StepInstall
          onDone={(c) => {
            setCreds(c);
            setStage("done");
          }}
        />
      )}
      {stage === "done" && <StepDone creds={creds} />}
    </WizardChrome>
  );
}
