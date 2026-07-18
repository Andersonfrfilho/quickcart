ENV ?= dev
ENV_FILE := envs/env.$(ENV)

PROJECT_NAME := $(shell grep -m1 '^PROJECT_NAME=' $(ENV_FILE) 2>/dev/null | cut -d '=' -f2)
PROJECT_NAME := $(if $(PROJECT_NAME),$(PROJECT_NAME),quickcart)

COMPOSE := docker compose -p $(PROJECT_NAME)-$(ENV) -f infra/docker-compose.yml --env-file $(ENV_FILE)

.PHONY: help up down logs migrate seed dev-api dev-worker dev-web test-msg validate

help: ## 📖 Lista os comandos disponíveis
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

up: ## 🚀 Sobe postgres + redis + wiremock
	@echo "🚀 Subindo infraestrutura ($(PROJECT_NAME)-$(ENV))..."
	@$(COMPOSE) up -d
	@echo "✅ Infra no ar (postgres, redis, wiremock)."

down: ## 🛑 Derruba a infraestrutura local
	@echo "🛑 Derrubando infraestrutura ($(PROJECT_NAME)-$(ENV))..."
	@$(COMPOSE) down

logs: ## 📜 Segue os logs da infra local
	@$(COMPOSE) logs -f

migrate: ## 🧱 Roda as migrations do Drizzle
	@echo "🧱 Rodando migrations ($(ENV))..."
	@cd apps/api-quickcart && bun --env-file ../../$(ENV_FILE) run db:migrate

seed: ## 🌱 Popula o catálogo via use-cases (nunca INSERT bruto)
	@echo "🌱 Rodando seeds ($(ENV))..."
	@cd apps/api-quickcart && bun --env-file ../../$(ENV_FILE) run db:seed

dev-api: ## 🔌 Sobe a api-quickcart em modo dev
	@echo "🔌 Iniciando api-quickcart..."
	@cd apps/api-quickcart && bun --env-file ../../$(ENV_FILE) --hot run src/index.ts

dev-worker: ## ⚙️ Sobe o worker-quickcart em modo dev
	@echo "⚙️ Iniciando worker-quickcart..."
	@cd apps/worker-quickcart && bun --env-file ../../$(ENV_FILE) --hot run src/index.ts

dev-web: ## 🖥️ Sobe o frontend-web em modo dev
	@echo "🖥️ Iniciando frontend-web..."
	@cd apps/frontend-web && bun run dev

test-msg: ## 💬 Simula um webhook Meta local (MSG="..." TEL=...)
	@bash scripts/send-test-webhook.sh "$(MSG)" "$(TEL)"

validate: ## ✅ Typecheck + testes de todos os apps
	@echo "✅ Validando api-quickcart..."
	@cd apps/api-quickcart && bunx tsc --noEmit && bun --env-file ../../envs/env.test test
