#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Run these commands from ~/Desktop/agent-mesh-sre in your terminal.
# Steps: fork on GitHub → init git → commit → push → open PR
# ─────────────────────────────────────────────────────────────────────────────

# 1. FORK FIRST — go to https://github.com/aswinayyolath/agent-mesh-sre
#    and click Fork (top-right). This creates https://github.com/YOUR_USERNAME/agent-mesh-sre

# 2. Init git in this folder and wire it to YOUR fork
cd ~/Desktop/agent-mesh-sre
git init
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/agent-mesh-sre.git
git remote add upstream https://github.com/aswinayyolath/agent-mesh-sre.git

# 3. Create the feature branch
git checkout -b feat/complete-runtime-and-ui

# 4. Stage everything (secrets are blocked by .gitignore)
git add .

# 5. Verify .env.local is NOT staged (should show nothing for that file)
git status | grep env

# 6. Commit
git commit -m "feat: complete runtime, UI, MCP registry and AsyncAPI specs

## What this PR adds

### Core runtime (src/lib/)
- types.ts        — full domain type system: AgentId, MralPhase, AgentStatus,
                    MCPToolCall, ReasoningOutput, ActionResult, AgentState,
                    BrokerState, ApprovalRequest, AuditRecord, LessonRecord,
                    NotificationRecord, BusEvent, AgentSummaryPayload
- mesh.ts         — MRAL loop engine: 4 agents, 4 scenarios, approval gates,
                    kill/restart, lesson learning, replay
- event-bus.ts    — globalThis SSE singleton (hot-reload safe)
- kafka.ts        — MOCK/REAL mode bridge via KafkaJS
- mcp.ts          — MCP Tool Registry: 8 typed tools with JSON Schema contracts,
                    policy tags, requiresApproval, per-agent AGENT_TOOLS binding
- asyncapi.ts     — AsyncAPI 3.0 programmatic specs for all 6 topics
- emailer.ts      — Nodemailer SMTP with full HTML MRAL trace email template;
                    graceful smtp_not_configured fallback

### API routes (src/app/api/)
- /api/mesh/stream    — SSE stream with 25s keep-alive pings
- /api/mesh/scenario  — POST trigger scenario
- /api/mesh/approve   — POST approve/reject pending tool calls
- /api/mesh/agent     — POST kill/restart agent
- /api/mesh/reset     — POST reset all state
- /api/mesh/snapshot  — GET full state snapshot
- /api/email/test     — POST send test MRAL summary email

### Dashboard UI (src/components/, src/app/)
- AgentCanvas.tsx   — ReactFlow topology: AgentNode (MRAL badge, status pulse,
                      Kill/Restart), BrokerNode, 6 animated topic edges;
                      fixed for @xyflow/react v12 (named export + NodeProps<Node<T>>)
- Dashboard.tsx     — full layout: nav, scenario sidebar, broker panel,
                      incident queue, notifications strip, audit log,
                      lessons learned, ApprovalGate modal, ToastStack
- useMeshStream.ts  — SSE client hook: useReducer state, exponential-backoff
                      reconnect, trigger/approve/agentAction/reset helpers
- app/page.tsx + layout.tsx + globals.css

### Config
- next.config.mjs   — replaces unsupported next.config.ts
- asyncapi.yaml     — generated AsyncAPI spec
- .env.local.example — full SMTP + Kafka env reference
- .gitignore        — blocks node_modules, .next, .env.local

### Scenarios implemented
- Consumer Lag Spike        (KIP-848) — scales consumers, requires approval
- KRaft Controller Failover (KRaft)   — acks epoch change, requires approval
- Share Group Rebalance     (KIP-932) — checkpoints offsets, requires approval
- False-Positive Suppression(KIP-848) — suppresses benign rebalance page"

# 7. Push to YOUR fork
git push -u origin feat/complete-runtime-and-ui

# 8. Open the PR — either via GitHub CLI or open this URL in your browser:
#    https://github.com/aswinayyolath/agent-mesh-sre/compare/main...YOUR_GITHUB_USERNAME:agent-mesh-sre:feat/complete-runtime-and-ui
#
#    Or with GitHub CLI (brew install gh):
#    gh pr create \
#      --repo aswinayyolath/agent-mesh-sre \
#      --base main \
#      --head YOUR_GITHUB_USERNAME:feat/complete-runtime-and-ui \
#      --title "feat: complete runtime, UI, MCP registry and AsyncAPI specs" \
#      --body-file PR_BODY.md
