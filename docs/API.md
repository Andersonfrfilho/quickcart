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
| POST | `/v1/orders` | sessão papel `cliente` | header `Idempotency-Key` obrigatório. **O telefone vem da sessão, não do corpo** — o `customer.phone` enviado é ignorado, porque ele é a chave de `customers` e aceitá-lo cru deixaria lançar pedido no telefone de outra pessoa. Body: `{ customer: { name, phone, email? }, items: [{ productId, quantity }], deliveryType: 'delivery'\|'pickup', address?, paymentMethod: 'pix'\|'card_on_delivery'\|'cash', receiptPreference: 'whatsapp'\|'email'\|'both', notes? }`. 409 `ORDER_INSUFFICIENT_STOCK` com `details.items` quando faltar estoque. A `Idempotency-Key` é reservada atomicamente (Redis `SET NX`); uma segunda requisição concorrente com a mesma chave aguarda o pedido em criação e devolve o mesmo resultado, ou recebe 409 `ORDER_IDEMPOTENCY_CONFLICT` se o timeout de espera (5s) expirar |
| GET | `/v1/orders/:shortCode?phone=` | — | phone deve conferir; 404 caso contrário |
| POST | `/v1/store/register` | — | cadastro do cliente final. Body: `{ name, email, phone, password }`. O papel é FIXO em `cliente` e nunca vem do corpo. O telefone liga o cadastro ao histórico: quem já comprou pelo WhatsApp tem o customer adotado, com os pedidos antigos. 409 `CUSTOMER_PHONE_ALREADY_REGISTERED` se o telefone já pertence a outra conta |
| GET | `/v1/store/orders` | sessão papel `cliente` | os pedidos de quem está logado. O dono sai do token, nunca da query — aceitar `customerId` do cliente entregaria o histórico alheio |

Navegar na loja (categorias, produtos, busca, carrinho) não exige login. **Fechar o pedido exige.**

## Webhook Meta

| Método | Rota | Notas |
|---|---|---|
| GET | `/v1/webhook/whatsapp` | verificação `hub.challenge` (texto puro) |
| POST | `/v1/webhook/whatsapp` | HMAC `x-hub-signature-256`; sempre responde 200 |

## Interno (worker → api)

| Método | Rota | Auth |
|---|---|---|
| POST | `/v1/internal/conversation/resume` | `Authorization: Bearer <access token da conta de serviço>` (papel `servico`) — body `{ sessionId, transcript: string \| null }`. `transcript: null` (STT falhou/sem chave) envia `AUDIO_NOT_SUPPORTED_YET` ao cliente sem retomar a conversa |

## Admin (`Authorization: Bearer <access token da sessão>`)

O access token vem de `POST /v1/auth/login` e vale 15 minutos; `POST /v1/auth/refresh` rotaciona o
refresh token e emite outro. Cada rota exige um conjunto explícito de papéis — não há hierarquia:
`admin` não herda nada de ninguém, e nenhum papel herda de `admin`.

| Método | Rota | Notas |
|---|---|---|
| GET/POST | `/v1/admin/categories` | |
| GET/POST | `/v1/admin/products` | listagem com `sortBy`, `sortDirection`, `filters[]`, paginação |
| PUT | `/v1/admin/products/:id` | |
| PATCH | `/v1/admin/products/:id/stock` | `{ stockQuantity }` ou `{ delta }` |
| GET | `/v1/admin/orders` | `status` (valores separados por vírgula), `page`, `perPage`, `sortBy` (`createdAt`,`totalInCents`,`status`), `sortDirection` |
| PATCH | `/v1/admin/orders/:id/status` | transições válidas; dispara notificação WhatsApp; cancel devolve estoque |

## Códigos de erro (em `shared/errors/codes.ts`)

`VALIDATION_ERROR`, `PRODUCT_NOT_FOUND`, `CATEGORY_NOT_FOUND`, `ORDER_NOT_FOUND`,
`ORDER_INSUFFICIENT_STOCK`, `ORDER_IDEMPOTENCY_CONFLICT`, `ORDER_INVALID_STATUS_TRANSITION`,
`IDEMPOTENCY_KEY_MISSING`, `WEBHOOK_INVALID_SIGNATURE`, `UNAUTHORIZED`, `INTERNAL_ERROR`.
