#!/usr/bin/env bash
# wait-ready.sh — block until Kafka, every KafkaTopic, every KafkaUser is
# Ready. Used by install.sh --wait but also runnable on its own.
set -euo pipefail
KCTL="${KCTL:-oc}"; command -v "$KCTL" >/dev/null 2>&1 || KCTL=kubectl
NS="${NAMESPACE:-agent-mesh-sre}"
CLUSTER="${KAFKA_CLUSTER:-agent-mesh-kafka}"

echo "▶ Kafka cluster"
$KCTL wait kafka/"$CLUSTER" -n "$NS" --for=condition=Ready --timeout=600s
echo "▶ Topics"
$KCTL wait kafkatopic --all -n "$NS" --for=condition=Ready --timeout=120s
echo "▶ Users"
$KCTL wait kafkauser --all -n "$NS" --for=condition=Ready --timeout=120s
echo "▶ Workloads"
$KCTL rollout status deploy/fast-producer -n "$NS"
$KCTL rollout status deploy/slow-consumer -n "$NS"
$KCTL rollout status deploy/cooperative-consumer -n "$NS"
$KCTL rollout status deploy/share-group-consumer -n "$NS"
echo "✓ All ready"
