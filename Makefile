.DEFAULT_GOAL := help
NS ?= agent-mesh-sre
CLUSTER ?= agent-mesh-kafka

.PHONY: help install wait uninstall credentials lag-spike failover share-rebalance benign-rebalance reset dev build typecheck

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "Available targets:\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ---------------- Cluster lifecycle ----------------

install: ## Apply Strimzi manifests to the active OpenShift context
	@./deploy/scripts/install.sh

install-wait: ## Apply manifests and wait until Kafka cluster + topics + users are Ready
	@./deploy/scripts/install.sh --wait

wait: ## Wait until everything is Ready (use after install)
	@./deploy/scripts/wait-ready.sh

uninstall: ## Remove the entire demo from the cluster (keeps Strimzi operator)
	@./deploy/scripts/install.sh --uninstall

credentials: ## Print a .env.local snippet with bootstrap, CA, password
	@./deploy/scripts/get-credentials.sh

# ---------------- Scenarios ----------------

lag-spike:           ## Real consumer lag spike (slow-consumer DELAY_MS=200, fast-producer +1)
	@./deploy/scenarios/01-lag-spike.sh

failover:            ## Real KRaft controller pod delete -> Strimzi reschedules
	@./deploy/scenarios/02-controller-failover.sh

share-rebalance:     ## KIP-932 share-group-consumer +1 (real share group rebalance)
	@./deploy/scenarios/03-share-group-rebalance.sh

benign-rebalance:    ## KIP-848 cooperative-consumer +1 (benign rebalance, agent should suppress)
	@./deploy/scenarios/04-benign-rebalance.sh

reset:               ## Reset workload replicas + env to defaults
	@./deploy/scenarios/99-reset.sh

# ---------------- App ----------------

dev:                 ## Run the Next.js app on http://localhost:3000
	npm run dev

build:               ## Production build of the Next.js app
	npm run build

typecheck:           ## Run TypeScript type-checker
	npx tsc --noEmit
