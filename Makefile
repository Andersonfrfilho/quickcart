ENV ?= dev
ENV_FILE := envs/env.$(ENV)

# Sobreposição local, fora do git: é onde vivem as chaves de verdade (Groq, por exemplo). Entra DEPOIS
# do arquivo base para vencer o valor versionado, e só se existir — passar `--env-file` de arquivo
# ausente derruba o bun. Sem isto, rodar pelo Makefile subia o serviço com a transcrição desligada em
# silêncio, e o sintoma era áudio sem resposta sem nada no log dizendo o porquê.
ENV_LOCAL_FILE := envs/env.$(ENV).local
ENV_LOCAL_ARG := $(if $(wildcard $(ENV_LOCAL_FILE)),--env-file=../../$(ENV_LOCAL_FILE),)

PROJECT_NAME := $(shell grep -m1 '^PROJECT_NAME=' $(ENV_FILE) 2>/dev/null | cut -d '=' -f2)
PROJECT_NAME := $(if $(PROJECT_NAME),$(PROJECT_NAME),quickcart)

# O nome de projeto do compose não aceita ponto, e `ENV=test.e2e` é a convenção de nome de env
# (`code-standart.md` §4). Sem trocar por hífen, `make up ENV=test.e2e` morre com
# "invalid project name" e o alvo nem chega a subir container.
COMPOSE_PROJECT := $(subst .,-,$(PROJECT_NAME)-$(ENV))

COMPOSE := docker compose -p $(COMPOSE_PROJECT) -f infra/docker-compose.yml --env-file $(ENV_FILE)

# Checkout local do SDK, para o loop de dev cross-repo. Sobrescreva se o seu clone estiver noutro
# lugar: make link-sdk SDK_PATH=~/dev/adatechnology-packages
SDK_PATH ?= $(HOME)/Documents/personal/adatechnology-packages
SDK_PACKAGES := packages/backend/meta-whatsapp-contracts packages/backend/meta-whatsapp-module packages/backend/text-moderation packages/backend/object-storage-provider packages/frontend/conversations-ui

.PHONY: help all setup up down clean logs migrate seed reseed-flow dev-api dev-worker dev-web test-msg test-audio test-reply test-button test test-api test-worker build-web validate link-sdk unlink-sdk watch-sdk

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
	@echo "✅ Infra no ar (postgres, redis, wiremock, minio, mailpit)."

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
	@cd apps/api-quickcart && bun --env-file=../../$(ENV_FILE) $(ENV_LOCAL_ARG) run db:migrate

notification-migrate: ## 🔔 Roda as migrations do notification-module (schema próprio, journal próprio)
	@echo "🔔 Migrations de notificação ($(ENV))..."
	@cd apps/api-quickcart && bun --env-file=../../$(ENV_FILE) $(ENV_LOCAL_ARG) run db:migrate-notification

user-migrate: ## 👤 Roda as migrations do user-module (schema próprio, journal próprio)
	@echo "👤 Migrations de usuário ($(ENV))..."
	@cd apps/api-quickcart && bun --env-file=../../$(ENV_FILE) $(ENV_LOCAL_ARG) run db:migrate-user

mail-ui: ## 📬 Abre a caixa de entrada falsa do Mailpit
	@echo "📬 Mailpit em http://localhost:$${MAILPIT_UI_PORT:-8025}"
	@open "http://localhost:$${MAILPIT_UI_PORT:-8025}" 2>/dev/null || true

address-inventory: ## 🔍 Conta as formas de endereço gravadas (SÓ LEITURA, seguro em qualquer ambiente)
	@echo "🔍 Inventariando endereços ($(ENV))..."
	@cd apps/api-quickcart && bun --env-file=../../$(ENV_FILE) $(ENV_LOCAL_ARG) run db:address-inventory

seed: ## 🌱 Popula o catálogo via use-cases (nunca INSERT bruto)
	@echo "🌱 Rodando seeds ($(ENV))..."
	@cd apps/api-quickcart && bun --env-file=../../$(ENV_FILE) $(ENV_LOCAL_ARG) run db:seed

reseed-flow: ## 🔁 Reaplica o grafo do fluxo principal (DESCARTA edição feita no painel)
	@echo "🔁 Reaplicando MAIN_FLOW ($(ENV))..."
	@cd apps/api-quickcart && bun --env-file=../../$(ENV_FILE) $(ENV_LOCAL_ARG) run db:reseed-flow

dev-api: ## 🔌 Sobe a api-quickcart em modo dev (Bun.serve nativo)
	@echo "🔌 Iniciando api-quickcart..."
	@cd apps/api-quickcart && bun --env-file=../../$(ENV_FILE) $(ENV_LOCAL_ARG) --watch src/index.ts

dev-worker: ## ⚙️ Sobe o worker-quickcart em modo dev
	@echo "⚙️ Iniciando worker-quickcart..."
	@cd apps/worker-quickcart && bun --env-file=../../$(ENV_FILE) --hot run src/index.ts

dev-web: ## 🖥️ Sobe o frontend-web em modo dev
	@echo "🖥️ Iniciando frontend-web..."
	@cd apps/frontend-web && bun run dev

ada-pins: ## 📌 Confere se os pins de @adatechnology/* batem com a tag rc publicada
	@bun run scripts/syncAdaPins.ts

ada-pins-write: ## 📌 Alinha os pins com a tag rc e pede reinstalação
	@bun run scripts/syncAdaPins.ts --write

test-msg: ## 💬 Simula um webhook Meta local (MSG="..." TEL=...)
	@bash scripts/send-test-webhook.sh "$(MSG)" "$(TEL)"

test-audio: ## 🎤 Simula uma nota de voz: sintetiza MSG com `say` e manda webhook de áudio (macOS)
	@bash scripts/send-test-webhook.sh "$(MSG)" "$(TEL)" audio

test-reply: ## 👆 Simula toque em item de lista (MSG=<id da linha> TEL=...)
	@bash scripts/send-test-webhook.sh "$(MSG)" "$(TEL)" list

test-button: ## 🔘 Simula toque em botão (MSG=<id do botão> TEL=...)
	@bash scripts/send-test-webhook.sh "$(MSG)" "$(TEL)" button

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

test: ## 🧪 Roda os testes de todos os apps (migra o banco de teste antes, se ele estiver de pé)
	@# Migra antes de testar porque parte da suite é de integração (Postgres + Redis reais), e banco de
	@# teste atrasado falha com "column X does not exist" — erro que parece regressão de código e não é.
	@# Aconteceu duas vezes em 04/08/2026. Migração é idempotente e custa ~1s.
	@#
	@# Sem infra de pé, o migrate falha e a suite roda de qualquer forma: os testes unitários não
	@# dependem de banco, e travar todos eles por causa disso seria pior que o aviso.
	@$(MAKE) --no-print-directory migrate ENV=test >/dev/null 2>&1 \
		|| echo "⚠️  banco de teste não migrado (infra fora?) — testes de integração podem falhar"
	@echo "🧪 Testes api-quickcart..."
	@cd apps/api-quickcart && bun run test
	@echo "🧪 Testes worker-quickcart..."
	@cd apps/worker-quickcart && bun run test

test-e2e: ## 🔁 E2E de notificação (infra e base PRÓPRIAS, ENV=test.e2e)
	@echo "🔁 Subindo infra do e2e..."
	@$(MAKE) up ENV=test.e2e
	@$(MAKE) migrate ENV=test.e2e
	@$(MAKE) notification-migrate ENV=test.e2e
	@echo "🔁 Rodando e2e..."
	@cd apps/api-quickcart && bun run test:e2e

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
