# init-claude.md — QuickCart

> Arquivo de contexto vivo para I.A. **Regra inquebrável:** toda mudança de arquitetura,
> rota nova ou regra de negócio alterada deve atualizar este arquivo no mesmo commit.

## O que é o QuickCart

Produto Ada Technology para supermercados: o cliente envia sua **lista de compras por texto ou
áudio no WhatsApp** e o bot monta o carrinho automaticamente. Itens com match único são
adicionados direto; itens ambíguos geram uma **lista interativa Meta** para o cliente escolher.
O pedido fecha com entrega/retirada, forma de pagamento e **recibo/nota fiscal por WhatsApp
e/ou e-mail**, emitido quando o pedido sai da loja (`out_for_delivery` ou `ready_for_pickup`),
com o total já final. Há também uma **loja Web/PWA** (busca com autocomplete, carrinho, checkout) que
grava no mesmo banco.

Requisito nº 1 do produto: **velocidade de atendimento**.

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Bun nativo em todos os apps (install/typecheck/test/build/execução) — `make dev-api` roda via `bun --watch` |
| API | `Bun.serve()` + Router próprio (matching de rota por regex, params posicionais; envelope `{ data }` / `{ error: { code, message } }`) |
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

### Roteiro de atendimento (`.specs/features/roteiro-atendimento/`)

- **Estados novos**: `AWAITING_CASH_CHANGE` e `AWAITING_CASH_CHANGE_AMOUNT` (troco no dinheiro),
  em `CashChangeHandler.ts`, fora do `CheckoutHandler`.
- **Colunas novas em `orders`**: `cash_change_for_in_cents` (nulável; `null` = "não precisa" —
  diferente de ausente = "ainda não perguntado", só existe em `ConversationContext`) e
  `delivery_fee_in_cents` (`not null default 0`; retirada sempre grava `0`).
- **`DELIVERY_FEE_CENTS`** (env da api, inteiro ≥ 0, padrão `0`): taxa de entrega fixa. **Fica
  FORA de `orders.total_in_cents`** — a NFC-e usa `total_in_cents` como valor pago e não admite
  frete (`modFrete = 9`); somar a taxa quebraria a nota. O valor cobrado do cliente é sempre
  `amountDueInCents(order)` (`modules/order/shared/amountDue.ts`, espelhada em
  `worker-quickcart/src/shared/amountDue.ts`) — **nenhum outro lugar soma itens + taxa**.
  Antes de ligar `DELIVERY_FEE_CENTS > 0` em produção, confirmar com o contador como a taxa é
  documentada no fiscal.
- **`requiresCardMachine(order)`** (`modules/order/shared/requiresCardMachine.ts`): única função
  que decide se o pedido exige levar a maquininha (`payment_method = card_on_delivery` **e**
  `delivery_type = delivery`); consumida pelo DTO do painel (`Order.controller.ts`) e pelo bot.
  Nunca reimplementar a comparação em outro lugar.
- **Rotas novas**: `GET /v1/admin/conversations/:number/checkout-context` (painel — bloco "Pedido
  em andamento", uma consulta por tabela: sessão, cliente, carrinho aberto, produtos em
  `findByIds`) e `POST /v1/store/checkout-quote` (loja web — preço sempre do banco via
  `buildPricedOrderItems`, nunca do carrinho salvo no navegador; substituiu o antigo
  `GET /v1/store/checkout-config`).
- **Palavra-chave global de atendente** (`isHumanHandoffRequest.ts`): "atendente"/"humano"/
  "pessoa"/frases curtas equivalentes, em qualquer estado, via `GlobalHandler`, casamento por
  mensagem inteira (não substring). Não cala o bot — só marca a fila de espera.

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
- [x] Fase 4 — motor de conversa + parser de lista + matcher
- [x] Fase 5 — carrinho, pedidos, decremento de estoque
- [x] Fase 6 — worker: fila STT (Groq) + notificações + Bull Board
- [x] Fase 7 — recibo/nota fiscal (pdfkit + nodemailer + processor receipt)
- [x] Fase 8 — frontend-web (loja + admin + PWA, build funcional)
- [x] Fase 9 — Dockerfiles, railway.toml, README/SETUP
