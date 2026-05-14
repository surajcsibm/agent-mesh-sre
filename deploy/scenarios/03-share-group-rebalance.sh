#!/usr/bin/env bash
# 03-share-group-rebalance.sh — scale the KIP-932 share-group-consumer up,
# triggering a real share-group rebalance. The Monitor agent recognises
# this as a share group event (not a classic consumer-group rebalance)
# and proposes a share-group-aware remediation.
set -euo pipefail
KCTL="${KCTL:-oc}"; command -v "$KCTL" >/dev/null 2>&1 || KCTL=kubectl
NS="${NAMESPACE:-agent-mesh-sre}"

CURRENT=$($KCTL get deploy/share-group-consumer -n "$NS" -o jsonpath='{.spec.replicas}')
NEW=$((CURRENT + 1))

echo "▶ Scaling share-group-consumer  $CURRENT → $NEW (KIP-932 share group rebalance)"
$KCTL scale deploy/share-group-consumer -n "$NS" --replicas="$NEW"
echo "✓ Watch the demo app — Monitor agent will cite KIP-932 in its reasoning."
