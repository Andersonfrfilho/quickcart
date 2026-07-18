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
| POST | `/v1/orders` | — | header `Idempotency-Key` obrigatório. Body: `{ customer: { name, phone, email? }, items: [{ productId, quantity }], deliveryType: 'delivery'\|'pickup', address?, paymentMethod: 'pix'\|'card_on_delivery'\|'cash', receiptPreference: 'whatsapp'\|'email'\|'both', notes? }`. 409 `ORDER_OUT_OF_STOCK` com `details.items` quando faltar estoque |
| GET | `/v1/orders/:shortCode?phone=` | — | phone deve conferir; 404 caso contrário |

## Webhook Meta

| Método | Rota | Notas |
|---|---|---|
| GET | `/v1/webhook/whatsapp` | verificação `hub.challenge` (texto puro) |
| POST | `/v1/webhook/whatsapp` | HMAC `x-hub-signature-256`; sempre responde 200 |

## Interno (worker → api)

| Método | Rota | Auth |
|---|---|---|
| POST | `/v1/internal/conversation/resume` | `X-Internal-Token` — body `{ sessionId, transcript }` |

## Admin (`Authorization: Bearer <ADMIN_API_TOKEN>`)

| Método | Rota | Notas |
|---|---|---|
| GET/POST | `/v1/admin/categories` | |
| GET/POST | `/v1/admin/products` | listagem com `sortBy`, `sortDirection`, `filters[]`, paginação |
| PUT | `/v1/admin/products/:id` | |
| PATCH | `/v1/admin/products/:id/stock` | `{ stockQuantity }` ou `{ delta }` |
| GET | `/v1/admin/orders` | `status[]` multi-valor, data tables |
| PATCH | `/v1/admin/orders/:id/status` | transições válidas; dispara notificação WhatsApp; cancel devolve estoque |

## Códigos de erro (em `shared/errors/codes.ts`)

`VALIDATION_ERROR`, `PRODUCT_NOT_FOUND`, `CATEGORY_NOT_FOUND`, `ORDER_NOT_FOUND`,
`ORDER_OUT_OF_STOCK`, `ORDER_INVALID_STATUS_TRANSITION`, `IDEMPOTENCY_KEY_MISSING`,
`WEBHOOK_INVALID_SIGNATURE`, `UNAUTHORIZED`, `INTERNAL_ERROR`.
