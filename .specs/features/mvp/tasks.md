# Tasks — QuickCart MVP

> Protocolo model-economy: planejar caro, executar barato. Cada fase declara o modelo
> recomendado. Gates obrigatórios ao fim de TODA task: `tsc --noEmit` (por app tocado),
> `bun test`, commit isolado da fase. Spec: `.specs/features/mvp/spec.md`.
> Referência de padrões: `~/Documents/personal/financiamento-imobiliario-bot` (paths na spec).
> Ao fechar cada fase: atualizar checklist do `init-claude.md`.

## Fase 0 — Scaffolding do monorepo
> 🤖 Modelo: `sonnet`

- [x] T0.1 Estrutura `apps/{api-quickcart,worker-quickcart,frontend-web}`, `package.json` raiz (workspaces bun), `tsconfig` base + por app (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- [x] T0.2 `envs/env.dev` + `envs/env.dev.local.example` + `envs/env.test` com todas as vars da spec §9
- [x] T0.3 `infra/docker-compose.yml`: postgres:17 (com `POSTGRES_INITDB_ARGS` padrão), redis:7, wiremock (mock Graph API — stub básico de `POST /*/messages` devolvendo wamid fake). Recursos nomeados `$(PROJECT_NAME)-$(ENV)-*`
- [x] T0.4 `Makefile` com emojis: `up`, `down`, `logs`, `migrate`, `seed`, `dev-api`, `dev-worker`, `dev-web`, `test-msg`, `validate`. `PROJECT_NAME=quickcart` lido de `envs/env.$(ENV)`
- [x] T0.5 `.gitignore`, `README.md` esqueleto

**Aceite:** `make up` sobe os 3 containers sem erro; `bun install` na raiz resolve workspaces.

## Fase 1 — Infra da API
> 🤖 Modelo: `sonnet`

- [x] T1.1 `infra/config/environment.ts` (zod, spec §9) — espelhar referência
- [x] T1.2 `infra/http/router.ts` + `server.ts`: uWS, CORS por `ALLOWED_ORIGINS`, envelope `{ data }`/`{ error: { code, message } }`, exception filter global (AppError → statusCode/code; desconhecido → 500 `INTERNAL_ERROR` sem stack), middlewares `validateBody`, `requireAdminToken`, `requireInternalToken`
- [x] T1.3 `shared/errors/`: `BaseError`/`AppError`, `codes.ts`, classes por domínio (`CatalogErrors`, `OrderErrors`, `ConversationErrors`, `WhatsAppErrors`)
- [x] T1.4 Drizzle: `infra/database/connection.ts`, `drizzle.config.ts`, migration 0000 (extensões `pg_trgm`/`unaccent` + função `immutable_unaccent`), `runMigrations` no boot
- [x] T1.5 Redis (`infra/redis/`) + BullMQ queues (`infra/queue/` — conexão ioredis dedicada `maxRetriesPerRequest: null`, `defaultJobOptions` com retenção limitada)
- [x] T1.6 DI container manual (`infra/container/index.ts`), logger (`@adatechnology/logger` ou pino com máscara `[traceId][timestamp][appName]...`), `GET /v1/health`
- [x] T1.7 `index.ts` com graceful shutdown (SIGTERM/SIGINT → drena uWS, fecha redis + pool)

**Aceite:** `make dev-api` sobe; `curl /v1/health` → `{ data: { status: 'ok' } }`; rota inexistente → envelope de erro.

## Fase 2 — Catálogo + busca
> 🤖 Modelo: `sonnet`

- [x] T2.1 Schemas Drizzle `categories` + `products` (spec §2) + migration + índices trigram
- [x] T2.2 Módulo `Catalog`: use-cases `CreateCategory`, `CreateProduct`, `UpdateProduct`, `AdjustStock`, `ListCategories`, `ListProducts` (paginação/sort/filters conforme spec §6), `SearchProducts` (query trigram spec §3.2, usada por autocomplete E matcher — mesma função)
- [x] T2.3 Rotas públicas `GET /v1/categories`, `GET /v1/products`, `GET /v1/products/search` + rotas admin CRUD/stock com `ADMIN_API_TOKEN`
- [x] T2.4 Seeds via use-cases: ~10 categorias e ~80 produtos reais de mercado brasileiro com `aliases` ricos (ex: arroz branco tio joão 1kg, aliases `{arroz, arroz branco}`; leite integral italac 1l, aliases `{leite, leite integral}`; inclua casos ambíguos de propósito: 3 arrozes, 4 leites, 3 sabões)
- [x] T2.5 Testes: busca com acento/sem acento, typo leve ("arros"), marca, alias

**Aceite:** `make seed` popula; `GET /v1/products/search?query=arros` retorna os arrozes ranqueados.

## Fase 3 — Webhook Meta + WhatsAppSender + transcript
> 🤖 Modelo: `sonnet`

- [x] T3.1 Schemas `customers`, `conversation_sessions`, `messages` + migration
- [x] T3.2 Módulo `Webhook` espelhando a referência (spec §5): GET verify timing-safe, POST com HMAC + idempotência Redis, parse tipado (text/audio/button_reply/list_reply/statuses), resposta sempre 200
- [x] T3.3 `WhatsAppSender` (spec §5) com modo mock dev; instanciado no container com `WHATSAPP_BASE_URL` apontável p/ wiremock
- [x] T3.4 Persistência de transcript (inbound no webhook, outbound no sender) + upsert de `customers`/`conversation_sessions` por telefone
- [x] T3.5 `make test-msg MSG="..." TEL=...` — script que monta payload Meta assinado (HMAC de dev) e faz POST no webhook local
- [x] T3.6 Testes: verify GET, HMAC inválido → 401 antes de tocar use-case, duplicata → ignorada

**Aceite:** `make test-msg MSG="oi"` cria customer, sessão e mensagem no banco (verificável via psql) e loga envio mock.

## Fase 4 — Motor de conversa + parser + matcher (núcleo do produto)
> 🤖 Modelo: `sonnet` (T4.2/T4.3 são o coração — algoritmo já fechado na spec §3; se surgir decisão de design não coberta, PARAR e perguntar)

- [ ] T4.1 `ConversationEngine` (`modules/conversation/`): carrega sessão, cadeia de handlers (Global → específico do estado, spec §4), atualiza `current_state`/`context`, tudo em `MessagesConstants`
- [ ] T4.2 `ParseShoppingList.use-case` (spec §3.1) — regex de quantidade/unidade + segmentação; `ListRefinerProvider.interface.ts` + `GroqListRefinerProvider` opcional (timeout 3s, fallback silencioso) + `NullListRefinerProvider`
- [ ] T4.3 `MatchProducts.use-case` (spec §3.2) reusando `SearchProducts` da Fase 2; classificação auto/ambíguo/não-encontrado com constantes
- [ ] T4.4 Handlers: Greeting, Menu (com atalho: texto ≥ 2 itens parseáveis vai direto p/ fluxo de lista), List, Resolve (lista interativa 1 item por vez + "nenhum desses"), Browse (categorias → produtos paginados → quantidade)
- [ ] T4.5 `list_imports` (schema + gravação a cada parse)
- [ ] T4.6 Testes unitários do parser (mín. 15 casos: "2kg de arroz", "arroz 2kg", "3x leite", "meia dúzia de ovos", lista com vírgulas/linhas/bullets) e do classificador do matcher (auto/ambíguo/zero)

**Aceite:** `make test-msg MSG="2kg arroz, leite, 6 ovos, sabão"` → arroz ambíguo (lista interativa), resposta simulada de list_reply adiciona; leite ambíguo; ovos auto; sabão ambíguo — transcript coerente no banco.

## Fase 5 — Carrinho, pedidos e estoque
> 🤖 Modelo: `sonnet`

- [ ] T5.1 Schemas `carts`, `cart_items`, `orders`, `order_items` + migration; gerador de `short_code` (`QC-` + sequência)
- [ ] T5.2 Módulo `Cart`: `AddCartItem`, `RemoveCartItem`, `UpdateCartItemQuantity`, `GetOpenCart` (1 cart open por customer/channel)
- [ ] T5.3 Módulo `Order`: `CreateOrderFromCart` (transação: cria order + items snapshot + decremento atômico spec §2; falha de estoque → erro com itens insuficientes), `CreateWebOrder` (spec §6, Idempotency-Key), `GetOrderByShortCode`, `UpdateOrderStatus` (+ devolução de estoque no cancel), `RepeatLastOrder`
- [ ] T5.4 Handlers de checkout no WhatsApp: CartReview, EditCart, DeliveryType, Address (reuso default_address), Payment, ReceiptPreference (+ awaiting_email), Confirming (spec §4)
- [ ] T5.5 Rotas `POST /v1/orders`, `GET /v1/orders/:shortCode`, admin orders (listagem data-tables + PATCH status → enfileira `notification`)
- [ ] T5.6 Testes: decremento concorrente (2 pedidos disputando estoque), cancelamento devolve estoque, idempotency-key repete resposta sem duplicar

**Aceite:** fluxo completo via `make test-msg` sequencial termina com order `confirmed`, estoque decrementado e job `receipt` enfileirado.

## Fase 6 — Worker: STT + notificações
> 🤖 Modelo: `sonnet`

- [ ] T6.1 App `worker-quickcart`: bootstrap BullMQ workers + graceful shutdown + Bull Board (porta própria, basic auth)
- [ ] T6.2 `SttProvider.interface.ts` + `GroqSttProvider` (whisper-large-v3-turbo, ogg direto) + `NullSttProvider` (sem key → devolve null)
- [ ] T6.3 Processor `stt`: fetch mídia (base64 da lib) → transcribe → `POST /v1/internal/conversation/resume` (rota nova na API com `INTERNAL_API_TOKEN`, injeta transcript como se fosse texto do cliente); null → mensagem pedindo texto
- [ ] T6.4 Processor `notification`: mensagens de status por template de texto
- [ ] T6.5 Testes: processor idempotente (job repetido não duplica mensagem)

**Aceite:** com `GROQ_API_KEY` de dev, áudio simulado vira transcript e segue o fluxo de lista; sem key, bot pede texto.

## Fase 7 — Recibo e nota fiscal
> 🤖 Modelo: `sonnet` (T7.2 integração fiscal é 🧠 — se a API da lib divergir da spec, validar com o usuário antes de improvisar)

- [ ] T7.1 `ReceiptProvider.interface.ts` + `SimpleReceiptProvider`: recibo texto formatado + PDF simples (pdfkit) com itens, totais, dados da loja (env `STORE_NAME`, `STORE_CNPJ?`, `STORE_ADDRESS`)
- [ ] T7.2 `FiscalReceiptProvider` usando `@adatechnology/fiscal-provider` (NFC-e modelo 65 + DANFE PDF) atrás de `FISCAL_ENABLED`; salvar `fiscal_document_id`
- [ ] T7.3 `EmailProvider` (nodemailer, spec §9); feature-flag derivada de SMTP configurado
- [ ] T7.4 Processor `receipt`: gera conforme provider ativo e entrega por `receipt_preference` (WhatsApp media e/ou e-mail); idempotente por `orders.fiscal_document_id`/flag de envio
- [ ] T7.5 Testes: preferência both com SMTP off → só WhatsApp + log warn

**Aceite:** pedido confirmado gera PDF e envia (mock) por WhatsApp; com SMTP dev (mailpit opcional no compose) chega e-mail.

## Fase 8 — Frontend Web/PWA
> 🤖 Modelo: `sonnet`

- [ ] T8.1 Scaffolding Vite + React + TanStack Router/Query + Tailwind + tokens de tema (`theme.constant.ts`, `spacing`, `scale()`) + locales com alias `text` + axios client com envelope unwrap (`r.data.data`)
- [ ] T8.2 Loja: Home (categorias), Category.page, autocomplete no header (debounce 250ms, teclado acessível), Cart.page (zustand persist), quantidade por unidade (kg aceita decimal)
- [ ] T8.3 Checkout.page (react-hook-form + zod espelhando schema da API) → `POST /v1/orders` com Idempotency-Key uuid → OrderConfirmed.page + OrderStatus.page (poll TanStack Query)
- [ ] T8.4 Admin: login por token (sessionStorage), AdminProducts.page e AdminOrders.page seguindo regra de data tables (ordenação, filtros multi-select, seleção massa, limpar filtros, estado na URL, zebra)
- [ ] T8.5 PWA: vite-plugin-pwa (manifest QuickCart, ícones 192/512 gerados, NetworkFirst `/api`, offline fallback); responsivo nos 3 breakpoints
- [ ] T8.6 Testes de build: `tsc --noEmit` + `vite build` limpos

**Aceite:** fluxo busca → carrinho → checkout cria pedido no banco e dispara recibo; Lighthouse PWA instalável.

## Fase 9 — Deploy Railway + docs finais
> 🤖 Modelo: `haiku`

- [ ] T9.1 Dockerfiles (api/worker: multi-stage Bun→node:22-slim com externals uWS; web: build → nginx com envsubst PORT) — copiar padrão da referência
- [ ] T9.2 `railway.toml` raiz + por app (healthcheck `/v1/health` na api)
- [ ] T9.3 README.md completo, SETUP.md (passo a passo Meta app + webhook), docs/DEPLOY.md
- [ ] T9.4 Atualização final do `init-claude.md` (estado, rotas, envs)

**Aceite:** `docker build` dos 3 apps passa localmente.
