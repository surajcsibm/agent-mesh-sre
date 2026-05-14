#!/usr/bin/env bash
# 99-reset.sh — return the workloads to their default state.
set -euo pipefail
KCTL="${KCTL:-oc}"; command -v "$KCTL" >/dev/null 2>&1 || KCTL=kubectl
NS="${NAMESPACE:-agent-mesh-sre}"

echo "▶ Resetting workloads"
$KCTL set env deploy/slow-consumer -n "$NS" DELAY_MS=0
$KCTL scale deploy/slow-consumer -n "$NS" --replicas=1
$KCTL scale deploy/fast-producer -n "$NS" --replicas=1
$KCTL scale deploy/cooperative-consumer -n "$NS" --replicas=2
$KCTL scale deploy/share-group-consumer -n "$NS" --replicas=1
echo "✓ Workloads reset to defaults"
