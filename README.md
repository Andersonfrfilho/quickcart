# QuickCart

Produto Ada Technology para supermercados: o cliente envia sua lista de compras por texto ou
áudio no WhatsApp e o bot monta o carrinho automaticamente. Há também uma loja Web/PWA que
compartilha o mesmo backend/banco.

Contexto completo, stack, convenções e estado atual: [`init-claude.md`](./init-claude.md).
Especificação: [`.specs/features/mvp/spec.md`](./.specs/features/mvp/spec.md) ·
[`.specs/features/mvp/tasks.md`](./.specs/features/mvp/tasks.md).
Contratos de API e banco: [`docs/API.md`](./docs/API.md) · [`docs/DATABASE.md`](./docs/DATABASE.md).

## Requisitos

- Bun ≥ 1.1
- Docker + Docker Compose (infra local: Postgres, Redis, WireMock)

## Começando

```bash
bun install         # resolve os workspaces (apps/*)
make up              # sobe postgres + redis + wiremock
make migrate          # aplica as migrations do Drizzle
make seed             # popula categorias/produtos via use-cases
make dev-api           # sobe a api-quickcart em modo dev
```

`GET http://localhost:3344/v1/health` deve responder `{ "data": { "status": "ok" } }`.

## Comandos

Veja a lista completa e comentada em [`init-claude.md`](./init-claude.md#comandos) ou rode
`make help`.

## Estrutura

```
quickcart/
├── apps/
│   ├── api-quickcart/        API principal (webhook, conversa, catálogo, pedidos)
│   ├── worker-quickcart/     BullMQ: STT, recibo/nota, notificações
│   └── frontend-web/         Loja + admin (React + PWA)
├── envs/                     env.dev / env.dev.local / env.test
├── infra/                    docker-compose.yml + mocks (WireMock)
├── .specs/features/mvp/      spec.md + tasks.md
└── docs/                     API.md · DATABASE.md · CONVERSATION_FLOW.md · DEPLOY.md
```

## Estado

Ver checklist de fases em [`init-claude.md`](./init-claude.md#estado-atual).
