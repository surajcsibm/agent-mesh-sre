#!/usr/bin/env bash
# install.sh — Apply the Agent Mesh SRE base manifests to an OpenShift cluster
# that already has Strimzi 0.51.0 installed (via OperatorHub or otherwise).
#
# Idempotent: re-running this is safe and only changes drift.
#
# Usage:
#   ./deploy/scripts/install.sh                  # full install
#   ./deploy/scripts/install.sh --wait           # also wait until Kafka is Ready
#   ./deploy/scripts/install.sh --uninstall      # tear everything down

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/../base" && pwd)"
NS="${NAMESPACE:-agent-mesh-sre}"
CLUSTER="${KAFKA_CLUSTER:-agent-mesh-kafka}"
WAIT_FOR_READY=false
UNINSTALL=false

for arg in "$@"; do
  case "$arg" in
    --wait) WAIT_FOR_READY=true ;;
    --uninstall) UNINSTALL=true ;;
    -h|--help)
      grep -E '^# ' "$0" | sed 's/^# //'
      exit 0
      ;;
  esac
done

KCTL="${KCTL:-oc}"
if ! command -v "$KCTL" >/dev/null 2>&1; then
  KCTL=kubectl
  command -v kubectl >/dev/null || { echo "Need oc or kubectl on PATH"; exit 1; }
fi

# ---------------------------------------------------------------------------
# Pre-flight: make sure the Strimzi operator is reachable in the cluster.
# ---------------------------------------------------------------------------
preflight() {
  echo "▶ Pre-flight"
  if ! $KCTL api-resources --api-group=kafka.strimzi.io 2>/dev/null | grep -q Kafka; then
    cat <<EOM >&2
✗ Strimzi CRDs not found.
  Install Strimzi 0.51.0 from OperatorHub first, then re-run this script.
  See deploy/README.md for the OpenShift install steps.
EOM
    exit 1
  fi
  local v
  v=$($KCTL get crd kafkas.kafka.strimzi.io -o jsonpath='{.metadata.labels.app\.kubernetes\.io/version}' 2>/dev/null || true)
  echo "  Strimzi CRDs detected (operator version: ${v:-unknown})"
  if $KCTL get ns "$NS" >/dev/null 2>&1; then
    echo "  Namespace $NS already exists"
  else
    echo "  Will create namespace $NS"
  fi
}

uninstall() {
  echo "▶ Uninstalling Agent Mesh SRE from $NS"
  for f in 05-demo-workloads 04-kafka-users 03-kafka-topics 02-kafka-cluster 01-kafka-nodepools 00-namespace; do
    $KCTL delete -f "$BASE_DIR/${f}.yaml" --ignore-not-found=true
  done
  echo "✓ Uninstall complete (PVCs deleted because deleteClaim=true)."
}

apply_step() {
  local file="$1" desc="$2"
  printf "▶ %-40s " "$desc"
  $KCTL apply -f "$BASE_DIR/$file" >/tmp/apply.out 2>&1 || {
    echo "FAIL"; cat /tmp/apply.out >&2; exit 1
  }
  awk '/created|configured|unchanged/{n++} END{printf "%d resources\n", n}' /tmp/apply.out
}

wait_for_ready() {
  echo "▶ Waiting for Kafka cluster $CLUSTER to be Ready (up to 10 min)…"
  $KCTL wait kafka/$CLUSTER -n "$NS" \
    --for=condition=Ready --timeout=600s
  echo "✓ Kafka cluster is Ready"
  echo "▶ Waiting for KafkaTopics…"
  $KCTL wait kafkatopic --all -n "$NS" --for=condition=Ready --timeout=120s || true
  echo "▶ Waiting for KafkaUsers…"
  $KCTL wait kafkauser --all -n "$NS" --for=condition=Ready --timeout=120s || true
  echo
  echo "Bootstrap servers:"
  echo "  internal TLS : $($KCTL get kafka $CLUSTER -n $NS -o jsonpath='{.status.listeners[?(@.name=="tls")].bootstrapServers}')"
  echo "  external     : $($KCTL get kafka $CLUSTER -n $NS -o jsonpath='{.status.listeners[?(@.name=="external")].bootstrapServers}')"
}

# ---------------------------------------------------------------------------
main() {
  if $UNINSTALL; then uninstall; exit 0; fi
  preflight
  apply_step 00-namespace.yaml         "Namespace"
  apply_step 01-kafka-nodepools.yaml   "KafkaNodePools (controller + broker)"
  apply_step 02-kafka-cluster.yaml     "Kafka cluster (KRaft, mTLS+SCRAM)"
  apply_step 03-kafka-topics.yaml      "KafkaTopics (ops.* + demo.*)"
  apply_step 04-kafka-users.yaml       "KafkaUsers (agents + controller + workload)"
  apply_step 05-demo-workloads.yaml    "Demo producer/consumer workloads"
  if $WAIT_FOR_READY; then wait_for_ready; fi
  cat <<EOM

╭──────────────────────────────────────────────────────────────────╮
│  ✓ Agent Mesh SRE installed                                       │
│                                                                    │
│  Next steps:                                                       │
│    1. ./deploy/scripts/get-credentials.sh > .env.local             │
│    2. cd .. && npm run dev                                         │
│    3. Open http://localhost:3000                                   │
│                                                                    │
│  To run scenarios from a terminal:                                 │
│    ./deploy/scenarios/01-lag-spike.sh                              │
│    ./deploy/scenarios/02-controller-failover.sh                    │
│    ./deploy/scenarios/03-share-group-rebalance.sh                  │
│    ./deploy/scenarios/04-benign-rebalance.sh                       │
│    ./deploy/scenarios/99-reset.sh                                  │
╰──────────────────────────────────────────────────────────────────╯
EOM
}

main "$@"
