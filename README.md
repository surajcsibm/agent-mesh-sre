# Agent Mesh on Streaming World

**Self-Healing, MCP-Governed AI Workflows for Apache Kafka.**

Companion artifact for the API Days proposal *"Agent Mesh on Streaming World: Building Self-Healing, MCP-Governed AI Workflows for Apache Kafka Driven Event and Data Streaming."*

This is the **drag-and-drop Agent Workflow Canvas** from Act 3 of the talk, brought to life as a runnable demo. Every node is an MCP-speaking AI agent, every edge is a Kafka topic governed by an AsyncAPI 3.0 contract, and every infrastructure-mutating tool call is policy-gated through a human-in-the-loop approval gate.

The demo runs in **three modes**, side-by-side:

| Mode | URL | What it does |
|---|---|---|
| **Simulator** | `/` | In-memory KRaft simulator. No infrastructure required. Five-minute laptop demo. |
| **Real cluster** | `/setup` | Provisions Strimzi 0.51.0 on OpenShift, then routes the very same UI through KafkaJS to your live cluster. |
| **Builder** | `/builder` | Drag-and-drop workflow editor that emits AsyncAPI 3.0 + Strimzi `KafkaTopic` / `KafkaUser` CRs. |

---

## What's in this build

- **Live KRaft simulator** with full M→R→A→L loop, animated event particles, kill/replay, audit topic, MCP tool registry, AsyncAPI contracts.
- **One-click Strimzi installer** that streams progress over SSE while it applies 6 manifest groups, waits for `Kafka` / `KafkaTopic` / `KafkaUser` to become `Ready`, and pulls back credentials.
- **Pluggable Kafka backend.** When real-mode is on, every record an agent produces is also written to the live cluster, and every record arriving on the cluster is mirrored back into the simulator. A terminal `kafka-console-consumer` sees exactly what the canvas shows.
- **Real scenario mutations.** Each scenario button switches between the in-memory simulator and real `oc set env` / `oc scale` / `oc delete pod` calls, with per-step toasts narrating what just happened on the cluster.
- **Drag-and-drop builder** at `/builder` with palette → canvas DnD, editable inspector for nodes and topic edges, JSON import/export, and a *Deploy preview* modal that renders the AsyncAPI spec, KafkaTopic CRs, and KafkaUser CRs the design would produce — all copy-paste-able and downloadable.
- **Live cluster status in the navbar.** Bootstrap host, brokers ready, controller epoch, mTLS / SCRAM / ACL counts — polled every 5 seconds against the real Strimzi resources.

---

## Why this exists

The proposal calls out a four-layer reusable blueprint. This codebase is a working implementation of all four layers, runnable end-to-end on a laptop without a real Kafka cluster, architected so each layer is adoptable independently.

| Layer | Implementation here |
|---|---|
| **Agent contract layer** | Each of the 4 agents hosts an MCP server with typed JSON-RPC tool definitions. See `src/lib/mcp.ts`. |
| **Channel contract layer** | Every Kafka topic has a full AsyncAPI 3.0 spec, browsable from the right inspector. See `src/lib/asyncapi.ts`. |
| **Execution governance layer** | Infrastructure-affecting MCP tool calls route through a policy approval gate rendered as a live card. Pluggable. |
| **Audit layer** | `ops.actions.audit.v1` is a first-class Kafka topic. Every agent decision, approval, tool call, and replay event is published there. |

---

## What you see on the canvas

- Four named agents (Intake, Monitor, Writer, Notification) laid out left-to-right.
- Five Kafka topic edges: `ops.requests.v1`, `ops.incidents.v1`, `ops.actions.audit.v1`, `ops.lessons.v1` (self-loop on Monitor — the LEARN channel), and a virtual metrics feed into Monitor.
- A live **M → R → A → L** progress strip (top-right) that lights up in real time as the Monitor agent moves between phases.
- Live animated **event particles** flying along each edge on every publish.
- A **policy approval** card that pulses in on every infra-mutating tool call.
- Right-side tabbed inspector: agent detail, AsyncAPI 3.0 contracts, MCP tool registry, Lessons learned, Audit stream, Outbound notifications.

---

## Run it

Requires **Node 20+**.

```bash
cd agent-mesh-sre
npm install
npm run dev
# open http://localhost:3000
```

No Docker, no broker, no AI keys required for the simulator path. To drive the demo against a real Kafka cluster, follow [Mode 2 — Real cluster](#mode-2--real-cluster) below.

---

## Step-by-step usage guide

Three modes. They share the same UI shell and the same agent runtime; only the Kafka backend changes. You can flip between them at any time.

### Mode 1 — Simulator (default, zero setup)

1. `npm run dev` and open `http://localhost:3000`.
2. Top bar shows **`MOCK`** with the simulated KRaft cluster: 3 brokers `online`, controller epoch, mTLS / SASL / ACL badges. Everything is in-process.
3. On the left rail, click any of the four **scenarios** (lag spike, KRaft failover, share-group rebalance, benign rebalance). Watch the canvas:
   - Particles travel along Kafka edges as records publish.
   - The **M → R → A → L** strip lights up in the top-right of the canvas.
   - For lag-spike + share-group, an **approval card** pulses on the left rail with the actual MCP `tools/call` JSON-RPC — click *Approve*.
4. Open the **Audit** tab on the right — every consume / publish / tool-call / approval / replay event is there.
5. The **"Replay moment"** card on the left rail kills the Writer agent, lets incidents pile up, then drains them via Kafka offset replay when you click *Restart & replay*. Inspect the Audit tab for `agent-kill` → `replay-start` → `replay-complete`.
6. Use **Reset** (top right of the rail) to clear all state and start over.

### Mode 2 — Real cluster (Strimzi 0.51.0 on OpenShift)

**Pre-requisites**

- An OpenShift cluster you can `oc login` to.
- **Strimzi 0.51.0 operator** installed in OperatorHub (or any namespace that watches `agent-mesh-sre`).
- `~/.kube/config` configured for the target cluster. The Next.js process reads it directly via `@kubernetes/client-node`. Whatever permissions your `oc whoami` has are the permissions the demo gets.
- ~8 vCPU / 12 GiB RAM headroom for 3 controllers + 3 brokers + 4 demo workloads + Cruise Control.

**Walkthrough**

1. From the main demo, click **Setup** in the top bar (or browse to `http://localhost:3000/setup`). This opens the **Setup Wizard**.
2. **Step 1 — Connect.** The wizard reads `~/.kube/config`, shows the cluster you're pointed at, and verifies the Strimzi operator is reachable. Confirm the namespace (`agent-mesh-sre`) and cluster name (`agent-mesh-kafka`).
3. **Step 2 — Install.** Click **Install**. The wizard streams 6 phases over SSE:
   - `00-namespace.yaml` → namespace ready
   - `01-kafka-nodepools.yaml` → controller + broker `KafkaNodePool`s
   - `02-kafka-cluster.yaml` → the `Kafka` CR with mTLS + SCRAM-SHA-512 (waits for `Ready: True`)
   - `03-kafka-topics.yaml` → 6 ops topics + `demo.payments.events`
   - `04-kafka-users.yaml` → 6 KafkaUsers (one per agent + the controller principal + a demo workload)
   - `05-demo-workloads.yaml` → `fast-producer` / `slow-consumer` / `cooperative-consumer` / `share-group-consumer`
   Each phase shows live `Ready` conditions polled from the cluster. Watch this happen in real time — it takes 2-4 minutes.
4. **Step 3 — Wire up.** When credentials become available, the wizard auto-flips the runtime to **`REAL`** mode and opens a `KafkaJS` client against the bootstrap route using the `agent-mesh-controller` SCRAM-SHA-512 user. The top bar updates: bootstrap host, broker count, controller epoch, ACL count are now live.
5. Return to `/`. The cluster chip now reads **`REAL`**. Click any **scenario** — a toast pops out in the bottom-right showing exactly what was just executed on your cluster:
   - `oc set env deploy/slow-consumer DELAY_MS=200`
   - `oc delete pod <controller-leader>`
   - `oc scale deploy/share-group-consumer --replicas=+1`
   - etc.
   The agents observe and react against the real cluster; particles still animate on the canvas because the real Kafka traffic is being mirrored into the simulator.
6. To verify with your own tools, in another terminal:
   ```bash
   oc -n agent-mesh-sre exec -it agent-mesh-kafka-broker-0 -- \
     bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
     --topic ops.actions.audit.v1 --from-beginning
   ```
   You will see the **same** records the canvas is rendering.
7. To roll back: from `/setup`, click **Uninstall** — it deletes the `Kafka` CR, all PVCs (`deleteClaim: true`), all CRDs scoped to the namespace, and the namespace itself. Strimzi operator stays installed.

**Manual fallback** — if you'd rather not drive the wizard:

```bash
./deploy/scripts/install.sh --wait                  # apply manifests + wait for Ready
./deploy/scripts/get-credentials.sh > .env.local    # write a ready-to-source env file
npm run dev                                         # the app picks up .env.local
```

See `deploy/README.md` for the full Strimzi/OpenShift detail.

### Mode 3 — Drag-and-drop builder

1. From the main demo, click **Builder** in the top bar (or browse to `http://localhost:3000/builder`). The builder loads with a starter mesh that mirrors the live demo topology.
2. **Add agents.** Drag any of the 6 templates from the left palette (Intake / Monitor / Writer / Notification / Policy / Custom) onto the canvas. Each drop creates an agent node with sensible defaults and the right MCP tool set.
3. **Wire up topics.** Hover over the right edge of any node — a handle dot appears. Drag from there to the left edge of another node. A new Kafka topic edge is created with a placeholder name.
4. **Edit anything.** Click a node or edge to open the right-side inspector:
   - Agents: rename, change role/accent, add/remove MCP tools, change description.
   - Topics: edit topic name, partitions (1-64), `cleanup.policy` (`delete` / `compact` / `compact,delete`), `retention.ms`, AsyncAPI contract URI.
5. **Self-loops.** Drag from a node's *top-right* handle to its *top-left* handle to create a self-feedback channel (this is how the Monitor agent's `ops.lessons.v1` LEARN loop is modelled).
6. **Save / load.** All edits autosave to `localStorage`. Use **Export** to download the design as JSON, **Import** to load one back. **Reset** restores the starter design.
7. **Deploy preview.** Click the green **Deploy** button. A modal opens with five tabs:
   - **Summary** — validation warnings (invalid topic names, duplicate topics, agents with no tools).
   - **AsyncAPI** — a complete AsyncAPI 3.0 document for the design.
   - **KafkaTopic CRs** — multi-doc YAML, ready for `oc apply -f`.
   - **KafkaUser CRs** — one per agent, with scoped SCRAM-SHA-512 + ACLs derived from each agent's consume/produce edges.
   - **Design JSON** — the raw design, for code review or version control.
   Each tab has **Copy** and **Download** buttons.
8. **Apply to cluster** (real mode only). When connected to a real cluster, the deploy modal shows an **Apply to cluster** button. Click it to:
   - Stream live SSE progress as each `KafkaTopic` and `KafkaUser` CR is applied via server-side apply.
   - Wait for each resource to become `Ready: True` (with live status updates).
   - Auto-refresh the cluster snapshot so the top bar immediately reflects the new topic/user counts.
   - See exactly which manifests were applied and their readiness state in real time.
9. **Run on canvas** (mock mode). In simulator mode, the deploy modal shows a **Run on canvas** toggle. Enable it to:
   - Start a client-side flow simulator that emits synthetic Kafka records along every edge in your design.
   - See animated particles travel along each topic edge on the canvas.
   - View per-edge counters showing total emitted records and last emit timestamp.
   - Adjust simulation speed (0.5–12 events/sec) via the play/pause controls in the builder top bar.
   - Stop the simulation to drain all in-flight particles and reset counters.

---

## API reference

All routes are JSON over HTTP unless noted. Most are wired to the demo UI; you can hit them directly from `curl` for scripting.

| Route | Method | Purpose |
|---|---|---|
| `/api/events` | `GET` (SSE) | Live stream of every `WireEvent` (particle, audit, agent-state, topic-record, approval, lesson, log). Used by the canvas. |
| `/api/scenario` | `POST` | Trigger a simulator scenario. Body: `{ "id": "lag-spike" \| "controller-failover" \| "share-group" \| "benign-rebalance" }`. |
| `/api/cluster/scenario` | `POST` | Same scenarios, but executes real `oc` mutations against the cluster. Returns the per-step shell-equivalents that ran. |
| `/api/approvals` | `POST` | `{ id, decision: "approve" \| "reject", actor }`. |
| `/api/agent` | `POST` | Kill or restart an agent. `{ agent, action: "kill" \| "restart" }`. |
| `/api/reset` | `POST` | Wipe simulator state. |
| `/api/asyncapi` | `GET` | All AsyncAPI 3.0 specs for the demo topics. |
| `/api/mcp` | `GET` | The MCP tool registry as JSON-RPC envelopes. |
| `/api/cluster/connect` | `GET` | Reads `~/.kube/config`, returns context + cluster info. |
| `/api/cluster/install` | `POST` (SSE) | Streams Strimzi install progress. |
| `/api/cluster/uninstall` | `POST` (SSE) | Streams Strimzi uninstall progress. |
| `/api/cluster/snapshot` | `GET` | Live snapshot of `Kafka` / `KafkaTopic` / `KafkaUser` resources. |
| `/api/cluster/credentials` | `GET` | Reads bootstrap + CA + SCRAM password from cluster Secrets. Localhost-only for safety. |
| `/api/cluster/mode` | `GET` / `POST` | Read or override the runtime mode (`mock` \| `real`). |
| `/api/cluster/tap` | `GET` / `POST` | Toggle the KafkaJS bridge between simulator and real cluster. Body: `{ "action": "enable" \| "disable" }`. |
| `/api/cluster/apply` | `POST` (SSE) | Apply a Builder design to the cluster as `KafkaTopic` + `KafkaUser` CRs. Body: `{ design: BuilderDesign, namespace?, waitReady? }`. Streams apply progress and readiness checks. |

---

## The 5-minute demo script

The demo is choreographed around four scripted scenarios on the left rail and one marquee replay moment. Total runtime: ~5 minutes.

### 0. Setup (10s)

Top bar shows **KRaft mode**, controller broker with current epoch, brokers online, **mTLS on**, **SASL/SCRAM on**, **ACLs active**. These are the production-pattern badges from Act 4 of the talk — security and governance are visible, not aspirational.

### 1. The healthy event story — KRaft failover (45s)

Click **"KRaft controller failover"** on the left rail.

- The MRAL strip (top-right of canvas) lights up `Monitor → Reason → Act → Learn`.
- Click the **Monitor** agent. The Inspector on the right shows `lastReasoning` — structured JSON the reasoning step emits: `kafkaFeatureCited: "KRaft"`, confidence `0.94`, `requiresApproval: false`.
- Narration: *"This is a KRaft leadership change. Static alerting would page someone. The agent ack'd it. Nothing paged — but every step is in the audit topic."*
- Open the **Audit** tab — every consume / publish / tool-call is there.

### 2. The escalation story — consumer lag spike (60s)

Click **"Consumer lag spike"**.

- ~24,000 message backlog on `payments-consumer`. Monitor's reasoning cross-references rebalance state (stable) and KRaft epoch (no change): this is real backlog, not benign churn.
- MRAL strip pauses on **AWAITING APPROVAL**.
- A pulsing **policy approval** card appears in the left rail. The audience sees the actual MCP `tools/call` JSON-RPC envelope for `kafka.scaleConsumers` with `delta: 2`.
- Narration: *"This is the execution-governance layer. No infrastructure mutation happens without this gate."*
- Click **Approve**. The action executes. An incident publishes to `ops.incidents.v1`. The Writer drafts a markdown postmortem. The Notification agent posts to Slack and opens an ITSM ticket — all visible as travelling particles on the canvas edges.

### 3. The Learn step — lessons feed back (30s)

After ~5 seconds a **lesson** appears in the **Lessons** tab: `lag before / lag after / effective / adjustedThreshold`. This is the 60-second settling window from the proposal, compressed for the demo.

Trigger another scenario. The Monitor's next `lastReasoning.rationale` literally cites *"Last N lessons informed this prompt: ..."*. That's the closed loop — past outcomes seed future decisions.

### 4. The suppression story — KIP-848 benign rebalance (30s)

Click **"Benign rebalance (suppress page)"**.

- Same lag rise, but rebalance state is `preparing-rebalance` — a healthy KIP-848 cooperative rebalance.
- No approval prompt. Reasoning returns `recommendedAction: rebalance-wait`.
- Narration: *"Static alerts false-positive here. The agent recognises the context and suppresses. This is the value of cross-referencing rebalance state."*

### 5. The marquee moment — Writer crash + Kafka replay (90s)

*This is the moment the proposal is built around — "the pivotal moment of the demo."*

On the left rail, in the **"The replay moment"** card:

1. Click **Kill** next to **Writer Agent**. Its node turns red and shows `CRASHED`.
2. Run two or three scenarios in quick succession — e.g. **lag spike**, **share group**, **KRaft failover** — approving any gates.
3. Watch incidents accumulate on the `ops.incidents.v1` edge. Click that edge — you can see the offset counter climbing and the records piling up unread in the inspector.
4. Narration: *"Point-to-point agent frameworks would lose this data. Because the channel is a Kafka topic, events are durable and replayable."*
5. Click **Restart & replay**. Writer goes `REPLAYING`, starts consuming from its last committed offset, drains the backlog, reports each incident to Slack + ITSM, and returns to `ONLINE`.
6. Check the **Audit** tab — it includes `agent-kill`, `agent-restart`, `replay-start`, `replay-complete` entries.

Zero data loss, in under 30 seconds, in front of the audience. That single moment makes the case for Kafka-as-backbone.

### 6. Close — production patterns (20s)

- Point back at the top-bar badges: **mTLS, SASL/SCRAM, ACLs**.
- Point at the **Outbound** tab: Slack + ITSM are the human-facing closure.
- *"Everything you just saw is routable to IBM Event Streams on Strimzi, OpenShift, Watson AIOps. The agent contracts don't change."*

---

## Four scenarios, four deterministic outcomes

| Scenario | Kafka feature | Reasoning output | Approval | Outcome |
|---|---|---|---|---|
| Consumer lag spike | KIP-848 (rebalance-aware) | `scale-consumers`, confidence 0.88 | **Required** | N → N+2 via Strimzi CRD |
| KRaft controller failover | KRaft | `controller-failover-ack`, confidence 0.94 | Not required | Ack + audit only |
| Share group rebalance | KIP-932 | `share-group-rebalance-ack`, confidence 0.86 | **Required** | Checkpoint share group |
| Benign rebalance | KIP-848 (suppression) | `rebalance-wait`, confidence 0.91 | Not required | False-positive suppressed |

---

## Project layout

```
agent-mesh-sre/
├── deploy/                          # Strimzi 0.51.0 manifests + scripts
│   ├── base/00-namespace.yaml
│   ├── base/01-kafka-nodepools.yaml
│   ├── base/02-kafka-cluster.yaml
│   ├── base/03-kafka-topics.yaml
│   ├── base/04-kafka-users.yaml
│   ├── base/05-demo-workloads.yaml
│   ├── scenarios/01-lag-spike.sh
│   ├── scenarios/02-controller-failover.sh
│   ├── scenarios/03-share-group-rebalance.sh
│   ├── scenarios/04-benign-rebalance.sh
│   ├── scenarios/99-reset.sh
│   └── scripts/{install,uninstall,get-credentials}.sh
├── src/
│   ├── app/                         # Next.js 14 app router
│   │   ├── page.tsx                 # Main UI - 3-column simulator/real-mode demo
│   │   ├── setup/page.tsx           # Setup Wizard for Strimzi install/uninstall
│   │   ├── builder/page.tsx         # Drag-and-drop workflow builder
│   │   ├── layout.tsx
│   │   ├── globals.css              # Tailwind v4 + theme tokens
│   │   └── api/
│   │       ├── events/route.ts       # SSE stream of every WireEvent
│   │       ├── scenario/route.ts     # Trigger a simulator scenario
│   │       ├── approvals/route.ts    # Approve/reject a policy gate
│   │       ├── agent/route.ts        # Kill / restart an agent
│   │       ├── reset/route.ts        # Reset mesh state
│   │       ├── asyncapi/route.ts     # AsyncAPI 3.0 specs
│   │       ├── mcp/route.ts          # MCP tool registry
│   │       └── cluster/
│   │           ├── connect/route.ts      # Verify kubeconfig + Strimzi operator
│   │           ├── install/route.ts      # SSE install pipeline
│   │           ├── uninstall/route.ts    # SSE teardown pipeline
│   │           ├── snapshot/route.ts     # Live KafkaTopic/KafkaUser/Kafka snapshot
│   │           ├── credentials/route.ts  # Pulls SCRAM creds + auto-enables tap
│   │           ├── mode/route.ts         # Read/write runtime mode
│   │           ├── scenario/route.ts     # Real cluster scenario mutations
│   │           └── tap/route.ts          # Toggle KafkaJS bridge
│   ├── lib/
│   │   ├── types.ts                 # Core domain types
│   │   ├── asyncapi.ts              # AsyncAPI 3.0 specs for every topic
│   │   ├── mcp.ts                   # MCP tool definitions with policyTags
│   │   ├── agents-config.ts         # Static definitions of the 4 agents
│   │   ├── broker.ts                # In-memory KRaft simulator
│   │   ├── mesh.ts                  # Agent runtime + M-R-A-L loop + crash/replay
│   │   ├── event-bus.ts             # In-process pub/sub for SSE
│   │   ├── runtime-mode.ts          # mock|real mode + cached credentials
│   │   ├── store.ts                 # Zustand client store (simulator)
│   │   ├── cluster-store.ts         # Zustand client store (real cluster)
│   │   ├── builder-store.ts         # Zustand client store (workflow builder)
│   │   ├── toasts.ts                # Toaster pub/sub
│   │   ├── sse-client.ts            # EventSource hook
│   │   ├── k8s/
│   │   │   ├── client.ts            # Wraps @kubernetes/client-node
│   │   │   ├── strimzi.ts           # Apply / wait / read CRs
│   │   │   └── holder.ts            # Singleton K8s client
│   │   └── kafka/
│   │       ├── backend.ts           # KafkaJS adapter (TLS + SCRAM-SHA-512)
│   │       └── tap.ts               # Bridge: real cluster <-> simulator
│   └── components/
│       ├── canvas/                  # Demo canvas (React Flow + particles + MRAL)
│       ├── panels/                  # TopBar, ScenarioPanel, ApprovalQueue, Inspector, EventLog
│       ├── setup/                   # Setup Wizard step components
│       ├── builder/                 # Builder palette + canvas + node + edge + inspector + deploy modal
│       └── ui/                      # Shared UI primitives (Toaster, JsonPretty, etc.)
├── package.json
├── next.config.mjs
└── tsconfig.json
```

---

## Implementation checklist — how the pattern maps

This is the sequential build order the proposal promises. Each bullet links to the file to read.

1. **Define agent contracts** → `src/lib/mcp.ts` (each MCP tool with `inputSchema`, `outputSchema`, `requiresApproval`, `policyTags`).
2. **Wire Kafka topics as AsyncAPI specs** → `src/lib/asyncapi.ts` (one AsyncAPI 3.0 fragment per topic, with `channels`, `operations`, `components.messages`, `components.schemas`).
3. **Implement MCP tool handlers** → `src/lib/mesh.ts` inside `act()` and `runNotification()`.
4. **Add policy gates** → `ApprovalRequest` lifecycle in `src/lib/mesh.ts` + `/api/approvals` route + left-rail UI.
5. **Wire the audit topic** → `audit_()` helper emits to `ops.actions.audit.v1` on every consume / publish / tool-call / approval-decision / agent-kill / agent-restart / replay-start / replay-complete.
6. **Run the canvas** → React Flow plus custom `AgentNode` + `TopicEdge` + `ParticleLayer`.

---

## The M → R → A → L pattern, concretely

Each phase has a visible, structured output:

| Phase | What it emits | Where to see it |
|---|---|---|
| **Monitor** | `MetricsSignal` (lag, ISR, rebalance state, controller epoch, share-group marker) on `ops.kafka.metrics.v1` | Click the Monitor edge, open *Recent records* |
| **Reason** | `ReasoningOutput` JSON `{rootCause, confidence, recommendedAction, requiresApproval, kafkaFeatureCited, proposedToolCall}` | Click Monitor agent → `lastReasoning` |
| **Act** | MCP JSON-RPC `tools/call` → `ActionResult` `{approved, approvedBy, outcome, detail, lagBefore, lagAfter}` | Click Monitor agent → `lastAction` |
| **Learn** | `LessonRecord` published to `ops.lessons.v1` with `{actionTaken, effective, lagBefore, lagAfter, adjustedThreshold, notes}`. Next reasoning prompt is seeded with the last 3. | Right inspector → **Lessons** tab |

---

## Architecture blueprint in one diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Agent Mesh SRE                                │
│                                                                        │
│   ┌──────────┐    ops.requests.v1     ┌──────────┐                   │
│   │  Intake  │ ─────────────────────▶ │ Monitor  │                    │
│   │  Agent   │                        │  Agent   │                    │
│   └──────────┘                        │          │ ◀── ops.lessons.v1 │
│        ▲                              │ M→R→A→L  │         ↻          │
│        │ MCP tools/call               │          │                    │
│        │                              └────┬─────┘                    │
│                                            │                          │
│                                   ops.incidents.v1                     │
│                                            │                          │
│                                            ▼                          │
│   ┌──────────────┐  ops.actions.audit.v1  ┌──────────┐                │
│   │ Notification │ ◀───────────────────── │  Writer  │                │
│   │    Agent     │                        │   Agent  │                │
│   └──────┬───────┘                        └──────────┘                │
│          │                                                             │
│          ├── Slack / ITSM                                              │
│          │                                                             │
│          └── ops.notifications.v1                                      │
│                                                                        │
│  ───────────────────────────────────────────────────────────────      │
│  Apache Kafka 4.x (KRaft) — mTLS, SASL/SCRAM, scoped ACLs              │
│  AsyncAPI 3.0 contracts + schema registry                              │
│  Audit topic: first-class, durable, replayable                         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Technology stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 + React 18 + TypeScript |
| Canvas | `@xyflow/react` (React Flow v12) + custom nodes/edges |
| Styling | Tailwind CSS v4 + hand-tuned theme tokens |
| State | Zustand |
| Icons | `lucide-react` |
| Transport | Server-Sent Events for the live stream |
| Kafka | In-memory simulator (swap for `kafkajs` for a real cluster) |

---

## IBM Event Streams / Strimzi migration

The agents speak to Kafka through a thin `BrokerSim` abstraction. In production, point them at:

- **Apache Kafka 4.x in KRaft mode**, deployed via Strimzi Cluster Operator or IBM Event Streams.
- **SASL/SCRAM + mTLS** — already advertised on the top bar.
- **Scoped ACLs per agent identity** — one Kafka principal per agent, least-privilege access.
- **AsyncAPI 3.0 specs registered in an Apicurio-style schema registry**.
- **`ops.actions.audit.v1` with `cleanup.policy=compact,delete` and `retention.ms=31536000000`** (one year) for compliance.
- **KRaft controller leadership** as a first-class signal into the Monitor agent's reasoning.

Runtime is Kubernetes. Strimzi's `KafkaUser` CRD + NetworkPolicies give you the principal-per-agent model described in Act 4.

---

## Status / limitations

- **Reasoning is deterministic** (no LLM call is made). The structured JSON shape matches what a real LLM reasoning step emits. Drop-in a Claude / GPT / watsonx.ai call in `Mesh.reason()` to swap it for a real model.
- **Simulator is in-memory.** Data does not persist across a server restart. In real mode the audit topic is durable; in simulator mode use **Reset** to clear state explicitly.
- The **Intake agent** is stub-simple (publishes on scenario trigger); the sophistication lives in Monitor. That matches the proposal.
- **Builder → Deploy** generates manifests but does **not** apply them automatically. Copy the YAML from the modal, review it, then `oc apply -f -` yourself — deploying generated infra without code review would defeat the audit story.
- **Real-mode credentials** are returned by `/api/cluster/credentials` only to localhost callers. If you expose the dev server on a LAN, set `KAFKA_MODE=mock` in the environment to be safe.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Cannot find module '.next/server/middleware-manifest.json'` on `npm run dev` | A previous `next build` was interrupted and corrupted `.next/`. | `rm -rf .next && npm run dev`. |
| `Maximum update depth exceeded` on `/builder` | Custom Zustand selectors should never return fresh object literals. | Keep selectors primitive: `useBuilder((s) => s.field)`, not `useBuilder((s) => ({...}))`. |
| Setup wizard hangs at `Kafka/agent-mesh-kafka` waiting for `Ready` | Strimzi operator not installed, or the namespace is not in its watch list. | `oc get csv -A \| grep strimzi`, then re-install if missing. |
| Real-mode scenario buttons fail with 503 | The KafkaJS tap isn't connected. | `curl -X POST localhost:3000/api/cluster/tap -d '{"action":"enable"}'`, or re-run the wizard. |
| Top bar still says `MOCK` after install completes | Credential secret rolled out after the wizard finished polling. | Hit `GET /api/cluster/credentials` once — it auto-flips the mode. |
| Builder design didn't persist across reload | Browser is in private mode (no `localStorage`). | Use a normal window, or **Export** before reload. |

---

## License

MIT

