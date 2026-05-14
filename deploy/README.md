# `deploy/` — Strimzi 0.51.0 manifests + scenario scripts

Everything in this directory targets a real OpenShift cluster running Strimzi
0.51.0. There are two ways to apply it:

1. **From the demo app's UI** — open `http://localhost:3000/setup` and click
   *Configure Kafka cluster*. The wizard talks to your cluster via your local
   `kubeconfig`, applies the same manifests, and shows live progress as each
   `Kafka` / `KafkaTopic` / `KafkaUser` becomes `Ready`.

2. **From your terminal** — run `./deploy/scripts/install.sh --wait`. Useful
   if you want to seed the cluster ahead of the talk and only point the app
   at it during the demo.

Both paths produce the same final state.

## Pre-requisites

- An OpenShift cluster you can `oc login` to.
- **Strimzi 0.51.0 operator** installed (cluster-wide is fine, namespace-scoped
  is fine too as long as it watches the `agent-mesh-sre` namespace). Easiest
  on OpenShift: OperatorHub → search "Strimzi" → install the 0.51.0 channel.
- `oc` (or `kubectl`) on your `PATH`.
- Enough cluster headroom for **3 controller pods + 3 broker pods + 4 demo
  workload pods + Cruise Control + Topic/User Operators** — roughly 8 vCPU
  and 12 GiB RAM. Tune the `resources` blocks in `01-kafka-nodepools.yaml`
  and `02-kafka-cluster.yaml` if your cluster is tight.

## What gets created

| File | Resources | Purpose |
|---|---|---|
| `base/00-namespace.yaml` | `Namespace agent-mesh-sre` | Isolated workspace for the demo |
| `base/01-kafka-nodepools.yaml` | `KafkaNodePool/controller` (×3), `KafkaNodePool/broker` (×3) | Split-role KRaft cluster |
| `base/02-kafka-cluster.yaml` | `Kafka/agent-mesh-kafka` | Kafka 4.2.0, mTLS + SCRAM-SHA-512, KIP-848, KIP-932, Cruise Control |
| `base/03-kafka-topics.yaml` | 6 ops topics + `demo.payments.events` | The AsyncAPI-governed agent mesh + the data-plane topic for scenarios |
| `base/04-kafka-users.yaml` | 6 KafkaUsers | One per agent + `agent-mesh-controller` (the demo app) + `demo-workload` |
| `base/05-demo-workloads.yaml` | 4 Deployments + 1 ConfigMap | `fast-producer`, `slow-consumer`, `cooperative-consumer`, `share-group-consumer` |

## Quick start

```bash
# 1. Install Strimzi 0.51.0 from OperatorHub (one-time, you do this manually).

# 2. Apply everything and wait until Kafka is Ready
./deploy/scripts/install.sh --wait

# 3. Generate a .env.local for the local Next.js app
./deploy/scripts/get-credentials.sh > ../.env.local

# 4. Start the demo
cd ..
npm install
npm run dev
# → http://localhost:3000
```

## Scenario scripts

These live in `deploy/scenarios/` and produce **real cluster mutations**.
Each scenario is also wired to a button in the app — both paths converge
on `oc set env` / `oc scale` / `oc delete pod` calls against the workloads
in this directory.

| Script | What it does |
|---|---|
| `01-lag-spike.sh` | `oc set env deploy/slow-consumer DELAY_MS=200` + scales `fast-producer` to 2. Lag accumulates on `demo.payments.events`/`payments-consumer`. |
| `02-controller-failover.sh` | `oc delete pod` on the active KRaft controller. Strimzi reschedules; controller epoch ticks. |
| `03-share-group-rebalance.sh` | `oc scale deploy/share-group-consumer +1`. KIP-932 share group rebalances. |
| `04-benign-rebalance.sh` | `oc scale deploy/cooperative-consumer +1`. Triggers a KIP-848 cooperative rebalance — the agent should **suppress** the page. |
| `99-reset.sh` | Returns all workloads to their default replicas + env. |

## Tear down

```bash
./deploy/scripts/install.sh --uninstall
```

This removes the Kafka cluster, all PVCs (`deleteClaim: true`), the namespace,
and every workload. Strimzi operator itself is left alone — uninstall it from
OperatorHub if you want to remove it entirely.

## Connecting the local app to a remote cluster

The Next.js app reads these env vars at startup (or via `.env.local`):

```bash
KAFKA_MODE=real                  # set 'mock' to use the in-memory simulator
KAFKA_NAMESPACE=agent-mesh-sre
KAFKA_CLUSTER=agent-mesh-kafka
KAFKA_BOOTSTRAP=...              # the external Route bootstrap from `oc get kafka -o jsonpath=...`
KAFKA_USERNAME=agent-mesh-controller
KAFKA_PASSWORD=...               # from secret/agent-mesh-controller .data.password
KAFKA_CA_CERT_BASE64=...         # from secret/agent-mesh-kafka-cluster-ca-cert .data.ca\.crt
```

`get-credentials.sh` produces a ready-to-source `.env.local` for you.

The same app also reads your local `kubeconfig` (default location: `~/.kube/config`)
to perform real scenario mutations (`oc scale`, `oc delete pod`). No additional
ServiceAccount is needed — the app runs with whatever permissions your `oc whoami`
identity has.

## How the app bridges sim ↔ real Kafka

When the Setup Wizard finishes (or `GET /api/cluster/credentials` is called),
the app stores the SCRAM password + CA in process memory and **auto-enables
the Kafka tap**. The tap is a `kafkajs` consumer + producer subscribed to the
6 ops topics + `demo.payments.events`:

- Every record an agent publishes through the simulator (`broker.append`) is
  also written to the same-named topic on the real cluster, so a
  `kafka-console-consumer` on a terminal sees exactly what the canvas shows.
- Every record arriving on the real cluster (e.g. produced by `fast-producer`,
  or by another tool you run) is mirrored back into the simulator and emitted
  as a `topic-record` wire event so the canvas animates in real time.

An `x-ams-source: agent-mesh-sim` header is stamped on outbound records to
prevent echo loops. The tap status is exposed at `GET /api/cluster/tap`; you
can disable it with `POST /api/cluster/tap` `{ "action": "disable" }` to keep
the UI on the simulator while the cluster keeps running.
