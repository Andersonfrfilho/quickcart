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

## Equipe (papel `admin`)

Rotas do `@adatechnology/user-module`, servidas em `/v1`. A tela é `/admin/equipe`, o `TeamWorkspace`
do `user-ui` com os papéis do QuickCart.

| Método | Rota | Notas |
|---|---|---|
| GET | `/v1/admin/users` | paginada. Devolve `{ data, pagination }` na RAIZ, sem `{ data: … }` em volta |
| POST | `/v1/admin/users` | cria com senha inicial. `409 USER_EMAIL_ALREADY_EXISTS` |
| POST | `/v1/admin/users/:id/password-reset` | só existe com SMTP configurado |

Editar e desativar membro **não têm rota** no pacote — o `user-ui` não desenha esses controles, por
ausência da capacidade no cliente.

## Códigos de erro (em `shared/errors/codes.ts`)

`VALIDATION_ERROR`, `PRODUCT_NOT_FOUND`, `CATEGORY_NOT_FOUND`, `ORDER_NOT_FOUND`,
`ORDER_INSUFFICIENT_STOCK`, `ORDER_IDEMPOTENCY_CONFLICT`, `ORDER_INVALID_STATUS_TRANSITION`,
`IDEMPOTENCY_KEY_MISSING`, `WEBHOOK_INVALID_SIGNATURE`, `UNAUTHORIZED`, `INTERNAL_ERROR`.
