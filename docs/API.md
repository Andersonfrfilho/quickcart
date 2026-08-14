# API — QuickCart (`api-quickcart`)

Fonte de verdade dos contratos: `.specs/features/mvp/spec.md` §6. Se este arquivo divergir
da implementação, a implementação vence — atualize aqui no mesmo PR.

Envelope: sucesso `{ "data": ... }` · lista `{ "data": [...], "pagination": { total, page, perPage } }` · erro `{ "error": { "code", "message" } }`.

## Público (loja)

| Método | Rota | Auth | Notas |
|---|---|---|---|
| GET | `/v1/health` | — | liveness db+redis |
| GET | `/v1/categories` | — | ordenadas por `sort_order` |
| GET | `/v1/products` | — | `categoryId`, `page`, `perPage` (máx 100), `sortBy` (`name`,`priceInCents`), `sortDirection` |
| GET | `/v1/products/search` | — | `query` (mín 2 chars), `limit` (default 8) — autocomplete trigram |
| POST | `/v1/orders` | — | header `Idempotency-Key` obrigatório. Body: `{ customer: { name, phone, email? }, items: [{ productId, quantity }], deliveryType: 'delivery'\|'pickup', address?, paymentMethod: 'pix'\|'card_on_delivery'\|'cash', receiptPreference: 'whatsapp'\|'email'\|'both', notes? }`. 409 `ORDER_INSUFFICIENT_STOCK` com `details.items` quando faltar estoque. A `Idempotency-Key` é reservada atomicamente (Redis `SET NX`); uma segunda requisição concorrente com a mesma chave aguarda o pedido em criação e devolve o mesmo resultado, ou recebe 409 `ORDER_IDEMPOTENCY_CONFLICT` se o timeout de espera (5s) expirar |
| GET | `/v1/orders/:shortCode?phone=` | — | phone deve conferir; 404 caso contrário |

## Webhook Meta

| Método | Rota | Notas |
|---|---|---|
| GET | `/v1/webhook/whatsapp` | verificação `hub.challenge` (texto puro) |
| POST | `/v1/webhook/whatsapp` | HMAC `x-hub-signature-256`; sempre responde 200 |

## Interno (worker → api)

| Método | Rota | Auth |
|---|---|---|
| POST | `/v1/internal/conversation/resume` | `Authorization: Bearer <INTERNAL_API_TOKEN>` — body `{ sessionId, transcript: string \| null }`. `transcript: null` (STT falhou/sem chave) envia `AUDIO_NOT_SUPPORTED_YET` ao cliente sem retomar a conversa |

## Admin (`Authorization: Bearer <ADMIN_API_TOKEN>`)

| Método | Rota | Notas |
|---|---|---|
| GET/POST | `/v1/admin/categories` | |
| GET/POST | `/v1/admin/products` | listagem com `sortBy`, `sortDirection`, `filters[]`, paginação |
| PUT | `/v1/admin/products/:id` | |
| PATCH | `/v1/admin/products/:id/stock` | `{ stockQuantity }` ou `{ delta }` |
| GET | `/v1/admin/orders` | `status` (valores separados por vírgula), `page`, `perPage`, `sortBy` (`createdAt`,`totalInCents`,`status`), `sortDirection` |
| PATCH | `/v1/admin/orders/:id/status` | transições válidas; dispara notificação WhatsApp; cancel devolve estoque, exceto depois de ocorrência `lost` |

### Esteira do pedido

`pending_confirmation` → `confirmed` → `preparing` → `separated` → entrega
(`out_for_delivery` → `in_transit` → `arrived_at_customer` → `completed`) ou retirada
(`ready_for_pickup` → `completed`). O trajeto aceita pular degrau para frente, nunca para trás.
`awaiting_customer_decision` é desvio da separação; `cancelled` é fim de linha.

Da rua o pedido pode cair em `delivery_failed`, e aí o corpo exige `deliveryFailureReason`
(`customer_absent`, `wrong_address`, `returned`, `refused`, `lost`) — a rota recusa a ocorrência sem
motivo e recusa motivo com qualquer outro status. O motivo decide o que vem depois: os três primeiros
admitem `out_for_delivery` de novo, `refused` e `lost` só permitem `cancelled`. E decide o estoque:
todo cancelamento devolve os itens, menos o que vem de `lost` — a sacola não voltou para a prateleira.
Sair de novo para a rua limpa o motivo. Cada resposta traz `allowedNextStatuses` já resolvido.

## Códigos de erro (em `shared/errors/codes.ts`)

`VALIDATION_ERROR`, `PRODUCT_NOT_FOUND`, `CATEGORY_NOT_FOUND`, `ORDER_NOT_FOUND`,
`ORDER_INSUFFICIENT_STOCK`, `ORDER_IDEMPOTENCY_CONFLICT`, `ORDER_INVALID_STATUS_TRANSITION`,
`IDEMPOTENCY_KEY_MISSING`, `WEBHOOK_INVALID_SIGNATURE`, `UNAUTHORIZED`, `INTERNAL_ERROR`.
