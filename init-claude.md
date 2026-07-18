# init-claude.md — QuickCart

> Arquivo de contexto vivo para I.A. **Regra inquebrável:** toda mudança de arquitetura,
> rota nova ou regra de negócio alterada deve atualizar este arquivo no mesmo commit.

## O que é o QuickCart

Produto Ada Technology para supermercados: o cliente envia sua **lista de compras por texto ou
áudio no WhatsApp** e o bot monta o carrinho automaticamente. Itens com match único são
adicionados direto; itens ambíguos geram uma **lista interativa Meta** para o cliente escolher.
O pedido fecha com entrega/retirada, forma de pagamento e **recibo/nota fiscal por WhatsApp
e/ou e-mail**. Há também uma **loja Web/PWA** (busca com autocomplete, carrinho, checkout) que
grava no mesmo banco.

Requisito nº 1 do produto: **velocidade de atendimento**.

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Bun (install/typecheck/test/build) / **Node 22 executa o processo HTTP** (dev local e Railway) — `uWebSockets.js` é addon V8 clássico (não N-API) e o loader de addons do Bun não o carrega; `make dev-api` roda via `node --import tsx --watch` (ver `.nvmrc`) |
| API | uWebSockets.js + Router próprio (envelope `{ data }` / `{ error: { code, message } }`) |
| Banco | PostgreSQL + Drizzle ORM (extensões `pg_trgm`, `unaccent`) |
| Filas | BullMQ sobre Redis (Redis já necessário p/ idempotência do webhook) |
| WhatsApp | `@adatechnology/whatsapp-provider` (Meta Cloud API) |
| Nota fiscal | `@adatechnology/fiscal-provider` (NFC-e/DANFE, opcional via `FISCAL_ENABLED`) |
| STT/LLM | Groq free tier (Whisper large-v3-turbo + Llama 3.3) — **opcional**, atrás de interface |
| Frontend | React 18 + Vite + TanStack Query/Router + Tailwind + vite-plugin-pwa |
| Deploy | Railway (Dockerfile por app) |

**Sem custo obrigatório de IA**: o matching de produtos é determinístico no Postgres
(`pg_trgm` + `unaccent` + coluna `aliases`). Groq só refina quantidade/unidade e transcreve
áudio; sem `GROQ_API_KEY` o bot funciona (áudio responde "me envie por texto").

## Monorepo

```
quickcart/
├── apps/
│   ├── api-quickcart/        API principal (webhook, conversa, catálogo, pedidos)
│   ├── worker-quickcart/     BullMQ: STT, recibo/nota, notificações e-mail/WhatsApp
│   └── frontend-web/         Loja + admin (React + PWA)
├── envs/                     env.dev / env.dev.local / env.test
├── infra/docker-compose.yml  postgres, redis, wiremock (mock da Graph API)
├── Makefile                  PROJECT_NAME=quickcart, recursos nomeados $(PROJECT_NAME)-$(ENV)-*
├── .specs/features/mvp/      spec.md (arquitetura) + tasks.md (fases com modelo por fase)
└── docs/                     API.md · DATABASE.md · CONVERSATION_FLOW.md · DEPLOY.md
```

Projeto de referência para padrões de código (webhook, WhatsAppSender, router, config zod,
DI container, Dockerfiles Railway, PWA): `~/Documents/personal/financiamento-imobiliario-bot`.
Diferença: lá o fluxo conversacional fica no n8n; **aqui o motor de conversa vive no código**.

## Regras do domínio (resumo — detalhes em .specs/features/mvp/spec.md)

- **Matcher lista → carrinho**: 1 match confiante (similarity ≥ 0.55 e gap ≥ 0.15) → auto;
  2–10 matches → lista interativa; 0 → "não encontrado" no resumo.
- **Estoque (contagem básica)**: `stockQuantity` decrementado transacionalmente na confirmação
  (`UPDATE ... WHERE stock_quantity >= qty`); devolvido no cancelamento; produto some da
  vitrine quando zera ou `isAvailable = false`.
- **Pedido**: channels `whatsapp` | `web`; pagamento sem gateway no MVP (Pix, cartão na
  entrega, dinheiro); `receiptPreference` = `whatsapp` | `email` | `both`.
- **Estados da conversa** em varchar (nunca enum de banco); handlers por estado em
  `modules/conversation/application/handlers/`.

## Comandos

> Pré-requisito local: `nvm use` (Node 22, ver `.nvmrc`) antes de `make dev-api`/`dev-worker` —
> o processo HTTP roda em Node, não em Bun (ver tabela de Stack acima).

```bash
make up          # sobe postgres + redis + wiremock
make migrate     # drizzle migrations
make seed        # seeds via use-cases (nunca SQL bruto)
make dev-api     # API em modo dev
make dev-worker  # worker em modo dev
make dev-web     # frontend em modo dev
make test-msg MSG="2kg arroz, leite" TEL=5511999999999   # simula webhook Meta
make validate    # typecheck + testes de todos os apps
```

## Convenções obrigatórias (rules globais do usuário se aplicam)

- Sufixos: `*.use-case.ts`, `*.service.ts`, `*.controller.ts`, `*.constant.ts`, `*.types.ts`,
  `*.interface.ts`, `*.schema.ts`, `*.error.ts`; frontend `*.component.tsx`, `*.page.tsx`,
  `*.hook.ts`, `*.query.ts`, `*.locale.json`.
- Funções com 2+ parâmetros recebem objeto tipado `<Nome>Params` / retorno `<Nome>Result`
  em `types/` do módulo.
- Erros estendem `BaseError` com código em `shared/errors/codes.ts`; exception filter global
  no Router; nunca vazar stack trace.
- Strings de UI em locales/constants; nada hardcoded.
- Frontend: TanStack Query obrigatório (`*.query.ts`), lógica em hooks, design tokens
  (`theme.constant.ts`, `scale()`), mobile-first, PWA.
- Seeds executam use-cases reais, nunca `INSERT` bruto.

## Estado atual

- [x] Especificação completa (`.specs/features/mvp/`)
- [x] Fase 0 — scaffolding
- [x] Fase 1 — infra API
- [x] Fase 2 — catálogo: schema `categories`/`products`, CRUD via use-cases, busca fuzzy
      (`pg_trgm` + `unaccent`, índices GIN de expressão, endpoint `GET /v1/products/search`),
      seeds (10 categorias, 80 produtos) e testes de integração
      (`DrizzleProductRepository.test.ts`)
- [x] Fase 3 — webhook Meta (GET verify + POST HMAC/idempotência Redis + parse tipado),
      `WhatsAppSender` com modo mock dev, persistência de transcript (inbound/outbound) e
      upsert de `customers`/`conversation_sessions`, script `make test-msg`, testes
      (`WebhookSignature.test.ts`, `ReceiveWhatsAppWebhook.use-case.test.ts`)
- [ ] Fase 4 — motor de conversa + parser de lista + matcher
- [ ] Fase 5 — carrinho, pedidos, decremento de estoque
- [ ] Fase 6 — worker: fila STT (Groq) + notificações
- [ ] Fase 7 — recibo/nota fiscal
- [ ] Fase 8 — frontend-web (loja + admin + PWA)
- [ ] Fase 9 — Dockerfiles, railway.toml, README/SETUP
