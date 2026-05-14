#!/usr/bin/env bash
# 01-lag-spike.sh — make the slow-consumer deliberately slow so consumer
# lag accumulates on the demo.payments.events topic. The Monitor agent
# in the running app will pick this up via Admin.fetchOffsets, reason over
# the metrics, and propose a remediation through the policy approval gate.
#
# Equivalent in-app action: click "Consumer lag spike" in the demo UI.
set -euo pipefail
KCTL="${KCTL:-oc}"; command -v "$KCTL" >/dev/null 2>&1 || KCTL=kubectl
NS="${NAMESPACE:-agent-mesh-sre}"

echo "▶ Inducing consumer lag on payments-consumer (demo.payments.events)"
$KCTL set env deployment/slow-consumer -n "$NS" DELAY_MS=200
$KCTL scale deployment/fast-producer -n "$NS" --replicas=2

cat <<EOM
✓ Lag spike scenario active.
  • slow-consumer DELAY_MS=200  (was 0)
  • fast-producer replicas=2    (was 1)
  Watch the demo app — Monitor agent should react within ~10s.
  To clear:  ./deploy/scenarios/99-reset.sh
EOM
