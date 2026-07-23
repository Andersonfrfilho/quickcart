# Spec — QuickCart MVP

Especificação executável do MVP. Leia junto com `init-claude.md` (contexto) e `tasks.md`
(fases + modelo recomendado). Padrões de código: rules globais + projeto de referência
`~/Documents/personal/financiamento-imobiliario-bot` (paths citados ao longo do documento).

---

## 1. Visão geral da arquitetura

```
WhatsApp ──▶ Meta Cloud API ──POST──▶ api-quickcart /v1/webhook/whatsapp
                                            │
                                   ConversationEngine (estados no Postgres)
                                            │
                              ┌─────────────┼──────────────┐
                        ListParser     ProductMatcher   Cart/Order use-cases
                        (regex+Groq)   (pg_trgm)             │
                                            │           BullMQ (Redis)
Web/PWA ──▶ api-quickcart /v1/* ────────────┘                │
                                                     worker-quickcart
                                                (STT · recibo/nota · e-mail · envio Zap)
```

- `api-quickcart` responde o webhook em milissegundos; trabalho pesado (STT de áudio,
  geração de recibo/NFC-e, envio de e-mail) vai para filas BullMQ.
- Redis é obrigatório (idempotência do webhook) → BullMQ é permitido pela regra
  `queue-bullmq.md` (reuso de Redis existente, volume pequeno, topologia simples).

## 2. Modelo de dados (Drizzle · Postgres)

Regras: PK `uuid` (v7 via `uuidv7()` da app), `varchar` no lugar de enum de banco,
`created_at`/`updated_at` `timestamptz` default now em todas as tabelas.
Extensões na primeira migration: `CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS unaccent;`

| Tabela | Colunas principais |
|---|---|
| `categories` | `id`, `name` varchar(120) unique, `sort_order` int default 0, `emoji` varchar(8) null |
| `products` | `id`, `category_id` FK, `name` varchar(160), `brand` varchar(80) null, `description` text null, `unit` varchar(16) (`un`,`kg`,`g`,`l`,`ml`,`dz`,`pct`), `unit_size` varchar(24) null (ex: `1kg`, `500ml`), `price_in_cents` int, `stock_quantity` int default 0, `is_available` boolean default true, `image_url` text null, `aliases` text[] default '{}', `barcode` varchar(14) null unique |
| `customers` | `id`, `phone` varchar(20) unique, `name` varchar(120) null, `email` varchar(160) null, `default_address` jsonb null |
| `conversation_sessions` | `id`, `customer_phone` varchar(20) unique, `current_state` varchar(40) default `'greeting'`, `context` jsonb default '{}', `mode` varchar(10) default `'bot'`, `last_interaction_at` timestamptz |
| `messages` | `id`, `session_id` FK, `direction` varchar(10) (`inbound`,`outbound`), `wa_message_id` varchar(80) null, `type` varchar(20), `body` text null, `payload` jsonb null, `status` varchar(16) null |
| `carts` | `id`, `customer_id` FK, `channel` varchar(10) (`whatsapp`,`web`), `status` varchar(16) (`open`,`ordered`,`abandoned`) |
| `cart_items` | `id`, `cart_id` FK, `product_id` FK, `quantity` numeric(10,3), `match_type` varchar(10) (`auto`,`selected`,`manual`), `original_term` varchar(160) null |
| `orders` | `id`, `short_code` varchar(8) unique (ex: `QC-1042`), `customer_id` FK, `cart_id` FK null, `channel` varchar(10), `status` varchar(20) (`pending_confirmation`,`confirmed`,`preparing`,`out_for_delivery`,`ready_for_pickup`,`completed`,`cancelled`), `total_in_cents` int, `delivery_type` varchar(10) (`delivery`,`pickup`), `address` jsonb null, `payment_method` varchar(20) (`pix`,`card_on_delivery`,`cash`), `receipt_preference` varchar(10) (`whatsapp`,`email`,`both`), `fiscal_document_id` varchar(60) null, `notes` text null |
| `order_items` | `id`, `order_id` FK, `product_id` FK, `product_name` varchar(160) (snapshot), `unit_price_in_cents` int (snapshot), `quantity` numeric(10,3), `total_in_cents` int |
| `list_imports` | `id`, `session_id` FK null, `source` varchar(10) (`text`,`audio`,`web`), `raw_text` text, `transcript` text null, `parse_result` jsonb, `matched_count` int, `ambiguous_count` int, `unmatched_count` int |

Índices de busca (migration dedicada):
```sql
CREATE INDEX products_name_trgm_idx  ON products USING gin (lower(unaccent(name)) gin_trgm_ops);
CREATE INDEX products_brand_trgm_idx ON products USING gin (lower(unaccent(coalesce(brand,''))) gin_trgm_ops);
```
(`unaccent` precisa de wrapper IMMUTABLE — criar função `immutable_unaccent` na migration.)

**Estoque** — decremento atômico na confirmação do pedido, dentro de transação:
```sql
UPDATE products SET stock_quantity = stock_quantity - $qty
WHERE id = $id AND stock_quantity >= $qty
```
Se alguma linha afetar 0 registros → rollback e o bot/checkout informa quais itens ficaram
sem estoque (oferece remover ou ajustar). Cancelamento devolve o estoque na mesma transação
que muda o status.

## 3. Motor lista → carrinho (núcleo)

### 3.1 `ParseShoppingList.use-case`
Entrada: texto livre (ou transcrição de áudio). Saída: `ParsedListItem[]`.

1. Normalizar: lowercase + unaccent + colapsar espaços.
2. Segmentar por: quebra de linha, `,`, `;`, ` e ` (conector), bullets (`-`, `*`, `•`), numeração (`1.`, `2)`).
3. Extrair quantidade/unidade por regex, nesta ordem (primeiro que casar vence):
   - `(\d+[.,]?\d*)\s*(kg|g|l|ml|litros?|quilos?|gramas?)\s+(.+)` → qty+unit+term
   - `(\d+)\s*(x|un|unidades?|pacotes?|caixas?|latas?|dz|d[uú]zias?)\s+(.+)`
   - `(.+?)\s+(\d+[.,]?\d*)\s*(kg|g|l|ml|un)$` (quantidade no fim: "arroz 2kg")
   - `(uma?|dois|duas|tr[eê]s|meia\s+d[uú]zia|uma\s+d[uú]zia)\s+(.+)` (extenso; `meia dúzia` → 6 un)
   - `(\d+)\s+(.+)` (número solto sem palavra de unidade: "6 ovos" → qty=6, unit=`un`, term="ovos")
   - fallback: qty=1, unit=`un`, term = linha inteira.
4. Se `GROQ_API_KEY` presente: enviar a lista inteira em UMA chamada ao Llama 3.3
   (`ListRefinerProvider.interface.ts`) que devolve JSON `{ term, quantity, unit }[]` — usado
   apenas para **corrigir** o resultado do regex quando divergir; timeout 3s, qualquer erro
   → fica o resultado do regex. O bot nunca depende do Groq.

### 3.2 `MatchProducts.use-case`
Para cada `ParsedListItem`, uma query:
```sql
SELECT id, name, brand, unit_size, price_in_cents,
       GREATEST(
         similarity(lower(immutable_unaccent(name)), $term),
         similarity(lower(immutable_unaccent(coalesce(brand,'') || ' ' || name)), $term),
         (SELECT COALESCE(MAX(similarity(lower(immutable_unaccent(a)), $term)), 0)
            FROM unnest(aliases) a)
       ) AS score
FROM products
WHERE is_available = true AND stock_quantity > 0
ORDER BY score DESC LIMIT 10
```
Classificação (constantes em `Matcher.constant.ts`):
- `MATCH_AUTO_THRESHOLD = 0.55`, `MATCH_GAP_THRESHOLD = 0.15`, `MATCH_MIN_THRESHOLD = 0.30`
- **auto**: top1 ≥ 0.55 **e** (top1 − top2) ≥ 0.15 → adiciona direto (`match_type = 'auto'`)
- **ambíguo**: ≥ 2 candidatos ≥ 0.30 → guardar candidatos no `context` da sessão p/ desambiguação
- **não encontrado**: top1 < 0.30

### 3.3 Desambiguação no WhatsApp
Um item ambíguo por vez (estado `resolving_items`, fila em `context.pendingResolutions`):
`sendInteractiveList` com até 10 rows — título = nome+marca+tamanho, description = preço —
mais a row fixa `skip_item` ("❌ Nenhum desses"). Resposta `list_reply.id = product:<uuid>`
adiciona com `match_type='selected'` e avança a fila. Ao esvaziar → `cart_review`.

## 4. Fluxo conversacional

Estados (`current_state`) e handlers (um arquivo por grupo em
`modules/conversation/application/handlers/`):

| Estado | Handler | O que faz |
|---|---|---|
| `greeting` | `GreetingHandler` | 1ª mensagem → boas-vindas + botões: 📝 `send_list` · 🛒 `browse` · 🔁 `repeat_order` |
| `main_menu` | `MenuHandler` | Roteia button_reply; texto livre longo (≥ 2 itens detectados) é tratado como lista direto — atalho de velocidade |
| `awaiting_list` | `ListHandler` | Texto → ParseShoppingList + MatchProducts; áudio → enfileira STT e responde "🎧 ouvindo seu áudio..." |
| `browsing_categories` | `BrowseHandler` | Lista interativa de categorias → produtos paginados (10/página, row `next_page`) → row adiciona ao carrinho (pergunta quantidade: `awaiting_quantity`) |
| `awaiting_quantity` | `BrowseHandler` | Número/`2kg` etc. → adiciona item `manual` |
| `resolving_items` | `ResolveHandler` | Desambiguação (seção 3.3) |
| `cart_review` | `CartHandler` | Resumo (itens, subtotal, não encontrados) + botões: ✅ `checkout` · ➕ `add_more` · ✏️ `edit_cart` |
| `editing_cart` | `CartHandler` | Lista interativa dos itens → remover/alterar quantidade |
| `awaiting_delivery_type` | `CheckoutHandler` | Botões 🛵 `delivery` · 🏪 `pickup` |
| `awaiting_address` | `CheckoutHandler` | Texto do endereço (reusa `customers.default_address` com botão "usar o mesmo") |
| `awaiting_payment` | `CheckoutHandler` | Botões 💠 `pix` · 💳 `card_on_delivery` · 💵 `cash` |
| `awaiting_receipt_preference` | `CheckoutHandler` | Botões 📱 `whatsapp` · 📧 `email` · dupla `both` (se `email` e cliente sem e-mail → pedir e-mail: `awaiting_email`) |
| `awaiting_email` | `CheckoutHandler` | Valida e-mail, grava em `customers` |
| `confirming` | `CheckoutHandler` | Resumo final + total → ✅ confirma (cria pedido, decrementa estoque, enfileira recibo) → `completed` |
| qualquer | `GlobalHandler` (primeiro da cadeia) | `sair`/`cancelar` reseta p/ `greeting`; `repeat_order` clona itens do último pedido p/ novo carrinho → `cart_review` |

Regras transversais:
- Sessão expira após 6h sem interação → próximo contato volta a `greeting` (verificação por `last_interaction_at`, sem cron no MVP).
- Toda mensagem inbound/outbound persiste em `messages`.
- Textos do bot em `MessagesConstants` (`modules/conversation/shared/Messages.constant.ts`) — nunca inline.

## 5. Webhook Meta (espelhar referência)

Espelhar de `financiamento-imobiliario-bot/apps/api/src/modules/webhook/`:
- GET verify com comparação timing-safe do `hub.verify_token`, devolve `hub.challenge` texto puro.
- POST: valida HMAC `x-hub-signature-256` com `WHATSAPP_APP_SECRET`; idempotência por
  `wa:msg:{id}` no Redis (TTL 3600s); responde sempre `200 { data: { status: 'ok' } }`.
- Parse tipado de `text`, `audio`, `interactive.button_reply`, `interactive.list_reply`
  e statuses (sent/delivered/read/failed → update em `messages.status`).
- Depois de persistir, despacha para `ConversationEngine.handle(params)` (fire-and-forget com
  catch → log; o webhook nunca espera o processamento).

`WhatsAppSender` espelhado da referência (`modules/conversations/infra/WhatsAppSender.ts`):
wrapper de `WhatsAppMessageProvider` com `sendText`, `sendInteractiveButtons`,
`sendInteractiveList`, `sendMedia`, `sendTemplate`, `fetchMediaAsBase64` + **modo mock dev**
(sem credenciais reais → loga e devolve wamid fake).

## 6. Contratos da API HTTP (envelope `{ data }` / `{ error: { code, message } }`)

Prefixo `/v1`. Rotas públicas da loja (sem auth) · rotas admin com `Authorization: Bearer <ADMIN_API_TOKEN>` (token estático de env no MVP).

| Método/rota | Descrição |
|---|---|
| `GET /v1/health` | liveness (db + redis) |
| `GET /v1/webhook/whatsapp` · `POST /v1/webhook/whatsapp` | Meta |
| `GET /v1/categories` | categorias ordenadas |
| `GET /v1/products?categoryId=&page=&perPage=&sortBy=&sortDirection=` | listagem paginada (perPage máx 100) |
| `GET /v1/products/search?query=&limit=` | **autocomplete** — mesma query trigram do matcher, limit padrão 8, mín. 2 chars |
| `POST /v1/orders` | cria pedido web: `{ customer: { name, phone, email? }, items: [{ productId, quantity }], deliveryType, address?, paymentMethod, receiptPreference, notes? }` — valida estoque, decrementa, enfileira recibo + confirmação WhatsApp. Idempotência por header `Idempotency-Key` (Redis 24h) |
| `GET /v1/orders/:shortCode?phone=` | status do pedido (phone confere com o cadastrado) |
| Admin: `GET/POST/PUT /v1/admin/products`, `PATCH /v1/admin/products/:id/stock`, `GET /v1/admin/orders?status[]=&sortBy=...`, `PATCH /v1/admin/orders/:id/status`, `GET/POST /v1/admin/categories` | CRUD + gestão; listagens seguem contrato de data tables (sortBy, sortDirection, filters[], paginação) |

Validação de todo body/query com zod (`*.schema.ts`) antes do use-case. Mudança de status
do pedido dispara notificação WhatsApp ao cliente (template/texto por status).

## 7. Worker (`worker-quickcart`)

Filas BullMQ (nomes em `Queue.constant.ts`; `defaultJobOptions` com retenção limitada
conforme regra queue-bullmq — falhas vivem mais que sucessos):

| Fila | Job | Ação |
|---|---|---|
| `stt` | `{ sessionId, mediaId }` | `fetchMediaAsBase64` → `SttProvider.transcribe` (Groq Whisper, ogg/opus direto) → reinjeta o transcript no `ConversationEngine` via `POST /v1/internal/conversation/resume` (header `X-Internal-Token`). Sem `GROQ_API_KEY` → bot responde pedindo texto |
| `receipt` | `{ orderId }` | monta recibo (texto + PDF via `pdfkit` ou HTML→texto simples); se `FISCAL_ENABLED` → NFC-e via `@adatechnology/fiscal-provider` (DANFE PDF, salva `fiscal_document_id`); entrega conforme `receipt_preference`: WhatsApp (`sendMedia`) e/ou e-mail (nodemailer) |
| `notification` | `{ orderId, event }` | mensagens de status (confirmado, saiu p/ entrega, pronto p/ retirada...) |

Processors idempotentes (checam estado no banco antes de reexecutar). Graceful shutdown
(SIGTERM → `worker.close()`). Bull Board em porta separada com basic auth de env.

## 8. Frontend (`frontend-web`)

Stack: Vite + React 18 + TanStack Router/Query + Tailwind + vite-plugin-pwa (copiar config
de PWA/proxy da referência `apps/web/vite.config.ts`). Estrutura por módulos
(`src/modules/<Modulo>/{components,pages,hooks,shared}`), sufixos das rules, locales
(`*.locale.json`-equivalente em `locales/` com import alias `text`), design tokens em
`src/modules/shared/theme/`.

Páginas loja: `Home.page` (categorias + destaques) · `Category.page` · `Search` (autocomplete
no header, debounce 250ms, `GET /products/search`) · `Cart.page` (zustand persist) ·
`Checkout.page` (react-hook-form + zod: nome, telefone, entrega/retirada, endereço,
pagamento, preferência de nota, e-mail se preciso) · `OrderConfirmed.page` (shortCode +
acompanhamento) · `OrderStatus.page`.

Admin (rota `/admin`, login por token): `AdminProducts.page` (tabela com regra data tables:
ordenação por cabeçalho, filtros multi-select, seleção em massa, limpar filtros, estado na
URL, zebra; edição inline de estoque/preço/disponibilidade) · `AdminOrders.page` (mudança de
status).

PWA: manifest (name QuickCart, ícones 192/512), Workbox NetworkFirst p/ `/api`, offline
fallback.

## 9. Config (zod em `infra/config/environment.ts`)

```
PORT, NODE_ENV, DATABASE_URL, REDIS_URL,
WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID,
WHATSAPP_WEBHOOK_VERIFY_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_API_VERSION (default v21.0),
WHATSAPP_BASE_URL (override p/ wiremock em dev),
GROQ_API_KEY?, FISCAL_ENABLED (default false), FISCAL_ENVIRONMENT (homologacao|producao),
FISCAL_CNPJ, FISCAL_INSCRICAO_ESTADUAL, FISCAL_RAZAO_SOCIAL, FISCAL_UF, FISCAL_MUNICIPIO,
FISCAL_CODIGO_MUNICIPIO, FISCAL_CEP, FISCAL_LOGRADOURO, FISCAL_NUMERO_ENDERECO, FISCAL_BAIRRO,
FISCAL_CRT (default '1'), FISCAL_CERTIFICADO_BASE64, FISCAL_CERTIFICADO_SENHA, FISCAL_SERIE (default '1'),
FISCAL_CSC_ID, FISCAL_CSC_TOKEN, FISCAL_DEFAULT_NCM/FISCAL_DEFAULT_CFOP/FISCAL_DEFAULT_CST
(classificação fiscal padrão do carrinho — MVP não tem NCM/CFOP/CST por produto),
SMTP_HOST?, SMTP_PORT?, SMTP_USER?, SMTP_PASS?, MAIL_FROM?,
ADMIN_API_TOKEN, INTERNAL_API_TOKEN, ALLOWED_ORIGINS, SENTRY_DSN?
```
Sem SMTP configurado → opção "e-mail" não é oferecida (feature-flag derivada).

## 10. Fora do escopo do MVP (registrar, não implementar)

Gateway de pagamento (Pix automático), handoff humano com painel de atendente, catálogo Meta
nativo sincronizado (`WhatsAppCatalogProvider` — fase 2 do produto), sugestão de lista por
histórico/IA, multi-loja/multi-tenant, RabbitMQ (BullMQ basta no volume atual).
