ENV ?= dev
ENV_FILE := envs/env.$(ENV)

PROJECT_NAME := $(shell grep -m1 '^PROJECT_NAME=' $(ENV_FILE) 2>/dev/null | cut -d '=' -f2)
PROJECT_NAME := $(if $(PROJECT_NAME),$(PROJECT_NAME),quickcart)

COMPOSE := docker compose -p $(PROJECT_NAME)-$(ENV) -f infra/docker-compose.yml --env-file $(ENV_FILE)

# Checkout local do SDK, para o loop de dev cross-repo. Sobrescreva se o seu clone estiver noutro
# lugar: make link-sdk SDK_PATH=~/dev/adatechnology-packages
SDK_PATH ?= $(HOME)/Documents/personal/adatechnology-packages
SDK_PACKAGES := packages/backend/meta-whatsapp-contracts packages/backend/meta-whatsapp-module packages/backend/text-moderation packages/backend/object-storage-provider packages/frontend/conversations-ui

.PHONY: help all setup up down clean logs migrate seed reseed-flow dev-api dev-worker dev-web test-msg test-audio test test-api test-worker build-web validate link-sdk unlink-sdk watch-sdk

help: ## 📖 Lista os comandos disponíveis
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

up: ## 🚀 Sobe postgres + redis + wiremock + minio
	@echo "🚀 Subindo infraestrutura ($(PROJECT_NAME)-$(ENV))..."
	@$(COMPOSE) up -d
	@echo "⏳ Aguardando banco aceitar conexões..."
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		$(COMPOSE) exec -T postgres pg_isready -U quickcart 2>/dev/null && break; \
		sleep 2; \
	done
	@echo "✅ Infra no ar (postgres, redis, wiremock, minio)."

down: ## 🛑 Derruba a infraestrutura local
	@echo "🛑 Derrubando infraestrutura ($(PROJECT_NAME)-$(ENV))..."
	@$(COMPOSE) down

clean: ## 🧹 Derruba e remove volumes (banco zerado)
	@echo "🧹 Removendo containers e volumes ($(PROJECT_NAME)-$(ENV))..."
	@$(COMPOSE) down -v
	@echo "✅ Containers e volumes removidos."

logs: ## 📜 Segue os logs da infra local
	@$(COMPOSE) logs -f

migrate: ## 🧱 Roda as migrations do Drizzle
	@echo "🧱 Rodando migrations ($(ENV))..."
	@cd apps/api-quickcart && bun --env-file=../../$(ENV_FILE) run db:migrate

seed: ## 🌱 Popula o catálogo via use-cases (nunca INSERT bruto)
	@echo "🌱 Rodando seeds ($(ENV))..."
	@cd apps/api-quickcart && bun --env-file=../../$(ENV_FILE) run db:seed

reseed-flow: ## 🔁 Reaplica o grafo do fluxo principal (DESCARTA edição feita no painel)
	@echo "🔁 Reaplicando MAIN_FLOW ($(ENV))..."
	@cd apps/api-quickcart && bun --env-file=../../$(ENV_FILE) run db:reseed-flow

dev-api: ## 🔌 Sobe a api-quickcart em modo dev (Bun.serve nativo)
	@echo "🔌 Iniciando api-quickcart..."
	@cd apps/api-quickcart && bun --env-file=../../$(ENV_FILE) --watch src/index.ts

dev-worker: ## ⚙️ Sobe o worker-quickcart em modo dev
	@echo "⚙️ Iniciando worker-quickcart..."
	@cd apps/worker-quickcart && bun --env-file=../../$(ENV_FILE) --hot run src/index.ts

dev-web: ## 🖥️ Sobe o frontend-web em modo dev
	@echo "🖥️ Iniciando frontend-web..."
	@cd apps/frontend-web && bun run dev

test-msg: ## 💬 Simula um webhook Meta local (MSG="..." TEL=...)
	@bash scripts/send-test-webhook.sh "$(MSG)" "$(TEL)"

test-audio: ## 🎤 Simula uma nota de voz: sintetiza MSG com `say` e manda webhook de áudio (macOS)
	@bash scripts/send-test-webhook.sh "$(MSG)" "$(TEL)" audio

link-sdk: ## 🔗 Aponta os pacotes do SDK para o checkout local (dev cross-repo)
	@echo "🔗 Registrando pacotes do SDK em $(SDK_PATH)..."
	@for package in $(SDK_PACKAGES); do \
		cd $(SDK_PATH)/$$package && bun link >/dev/null || exit 1; \
	done
	@echo "🔗 Ligando no quickcart..."
	@cd apps/api-quickcart && bun link @adatechnology/meta-whatsapp-contracts @adatechnology/meta-whatsapp-module @adatechnology/text-moderation @adatechnology/object-storage-provider >/dev/null
	@cd apps/worker-quickcart && bun link @adatechnology/meta-whatsapp-contracts @adatechnology/meta-whatsapp-module @adatechnology/object-storage-provider >/dev/null
	@cd apps/frontend-web && bun link @adatechnology/meta-whatsapp-contracts @adatechnology/conversations-ui >/dev/null
	@echo "✅ SDK linkado. Rode 'make watch-sdk' noutro terminal para rebuildar a cada edição."

unlink-sdk: ## 🔓 Volta a consumir os pacotes publicados do registry
	@echo "🔓 Desligando o SDK local..."
	@cd apps/api-quickcart && bun unlink @adatechnology/meta-whatsapp-contracts @adatechnology/meta-whatsapp-module @adatechnology/text-moderation @adatechnology/object-storage-provider >/dev/null 2>&1 || true
	@cd apps/worker-quickcart && bun unlink @adatechnology/meta-whatsapp-contracts @adatechnology/meta-whatsapp-module @adatechnology/object-storage-provider >/dev/null 2>&1 || true
	@cd apps/frontend-web && bun unlink @adatechnology/meta-whatsapp-contracts @adatechnology/conversations-ui >/dev/null 2>&1 || true
	@bun install
	@echo "✅ Consumindo o registry de novo."

watch-sdk: ## 👀 Rebuilda o conversations-ui a cada edição (par do link-sdk)
	@cd $(SDK_PATH)/packages/frontend/conversations-ui && bun run build:watch

test: ## 🧪 Roda os testes de todos os apps (unitários, sem infra)
	@echo "🧪 Testes api-quickcart..."
	@cd apps/api-quickcart && bun run test
	@echo "🧪 Testes worker-quickcart..."
	@cd apps/worker-quickcart && bun run test

test-api: ## 🧪 Roda apenas os testes da API
	@cd apps/api-quickcart && bun run test

test-worker: ## 🧪 Roda apenas os testes do worker
	@cd apps/worker-quickcart && bun run test

build-web: ## 📦 Build de produção do frontend
	@echo "📦 Build frontend-web..."
	@cd apps/frontend-web && bun run build

all: setup ## 🚀 Sobe tudo (infra + migrate + seed + validate + dev)
	@echo "✅ QuickCart pronto! Acesse:"
	@echo "   API:     http://localhost:3344/v1/health"
	@echo "   Web:     http://localhost:5183"
	@echo "   Admin:   http://localhost:5183/#/admin"

setup: up migrate seed validate ## 🔧 Setup completo do zero (infra + banco + validação)

validate: ## ✅ Typecheck + testes + build de todos os apps
	@echo "🔍 Typecheck api-quickcart..."
	@cd apps/api-quickcart && bunx tsc --noEmit
	@echo "🔍 Typecheck worker-quickcart..."
	@cd apps/worker-quickcart && bunx tsc --noEmit
	@echo "🔍 Typecheck frontend-web..."
	@cd apps/frontend-web && bunx tsc --noEmit
	@echo "🧪 Testes api-quickcart..."
	@cd apps/api-quickcart && bun run test
	@echo "🧪 Testes worker-quickcart..."
	@cd apps/worker-quickcart && bun run test
	@echo "📦 Build frontend-web..."
	@cd apps/frontend-web && bun run build
	@echo "✅ Tudo validado!"
