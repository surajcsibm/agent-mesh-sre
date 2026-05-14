#!/usr/bin/env bash
# 02-controller-failover.sh — delete the active KRaft controller pod so
# Strimzi reschedules it. The controller epoch ticks up. The Monitor agent
# observes this via Admin.describeCluster() and acks it without paging.
#
# Equivalent in-app action: click "KRaft controller failover".
set -euo pipefail
KCTL="${KCTL:-oc}"; command -v "$KCTL" >/dev/null 2>&1 || KCTL=kubectl
NS="${NAMESPACE:-agent-mesh-sre}"
CLUSTER="${KAFKA_CLUSTER:-agent-mesh-kafka}"

echo "▶ Identifying current KRaft controller leader"
# Strimzi annotates the active controller pod when reconciled; otherwise
# delete pod 0 (round-robin re-election will pick a new leader).
TARGET=$($KCTL get pod -n "$NS" \
  -l strimzi.io/cluster="$CLUSTER",strimzi.io/pool-name=controller \
  -o jsonpath='{range .items[?(@.metadata.annotations.strimzi\.io/kraft-controller-id!="")]}{.metadata.name}{"\n"}{end}' \
  | head -1)
TARGET="${TARGET:-${CLUSTER}-controller-0}"

echo "▶ Deleting controller pod: $TARGET"
$KCTL delete pod -n "$NS" "$TARGET" --grace-period=10
echo "✓ Strimzi will reschedule it. Watch in the demo app — controller epoch will tick up."
