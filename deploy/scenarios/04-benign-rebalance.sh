#!/usr/bin/env bash
# 04-benign-rebalance.sh — scale the cooperative-consumer up by one, which
# triggers a real KIP-848 cooperative rebalance (state="preparing-rebalance"
# briefly). Lag will rise during the rebalance window. The Monitor agent
# cross-references the rebalance state and SUPPRESSES the page — this is
# the value of context-aware reasoning vs static thresholds.
set -euo pipefail
KCTL="${KCTL:-oc}"; command -v "$KCTL" >/dev/null 2>&1 || KCTL=kubectl
NS="${NAMESPACE:-agent-mesh-sre}"

CURRENT=$($KCTL get deploy/cooperative-consumer -n "$NS" -o jsonpath='{.spec.replicas}')
NEW=$((CURRENT + 1))

echo "▶ Scaling cooperative-consumer  $CURRENT → $NEW  (triggers KIP-848 cooperative rebalance)"
$KCTL scale deploy/cooperative-consumer -n "$NS" --replicas="$NEW"
echo "✓ Lag will rise briefly during rebalance. Monitor should mark it 'rebalance-wait' (no page)."
