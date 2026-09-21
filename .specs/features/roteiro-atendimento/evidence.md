# Evidência de execução — Lacunas do roteiro de atendimento

## T1.1 — Troco no dinheiro

### Arquivos alterados/criados

**Banco**
- `apps/api-quickcart/drizzle/migrations/0020_order_cash_change.sql` (novo) — `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_change_for_in_cents integer`, aditiva e nulável.
- `apps/api-quickcart/drizzle/migrations/meta/_journal.json` — entrada `idx: 20`, `when: 1790034492528` (maior que o `1790032528415` da 0019), `tag: "0020_order_cash_change"`.
- `apps/api-quickcart/src/infra/database/schema/orders.ts` — coluna `cashChangeForInCents`.

**Domínio/aplicação (api-quickcart)**
- `apps/api-quickcart/src/modules/order/domain/OrderRepository.interface.ts` — `cashChangeForInCents` em `OrderRecord` e `CreateOrderWithItemsParams`.
- `apps/api-quickcart/src/modules/order/infra/database/DrizzleOrderRepository.ts` — mapeamento em `toOrderRecord` e gravação no `insert`.
- `apps/api-quickcart/src/modules/order/application/types/CreateOrderFromCart.types.ts` e `CreateOrderFromCart.use-case.ts` — parâmetro repassado ao repositório.
- `apps/api-quickcart/src/modules/conversation/shared/ConversationState.constant.ts` — estados `AWAITING_CASH_CHANGE` e `AWAITING_CASH_CHANGE_AMOUNT`.
- `apps/api-quickcart/src/modules/conversation/shared/ConversationContext.types.ts` — `checkoutCashChangeForInCents?: number | null` (ausente = não perguntado; `null` = "não preciso").
- `apps/api-quickcart/src/modules/conversation/shared/Messages.constant.ts` — `CASH_CHANGE_BUTTON_ID`, `CASH_CHANGE_BUTTONS` (2 botões, dentro do limite de 3), e as strings novas (`CHECKOUT_ASK_CASH_CHANGE*`, `CASH_CHANGE_SUMMARY_SUFFIX`, `ORDER_CONFIRMED_CASH_CHANGE_LINE`).
- `apps/api-quickcart/src/modules/conversation/shared/parseCashAmountToCents.ts` (novo) — parser puro.
- `apps/api-quickcart/src/modules/conversation/application/handlers/support/cartTotal.ts` (novo) — soma do carrinho, porta estreita reutilizável.
- `apps/api-quickcart/src/modules/conversation/application/handlers/support/amountDue.ts` (novo) — isola "total a pagar" (hoje = total dos itens) para a T2.1 somar a taxa depois.
- `apps/api-quickcart/src/modules/conversation/application/handlers/CashChangeHandler.ts` (novo) — os dois estados novos, fora do `CheckoutHandler`.
- `apps/api-quickcart/src/modules/conversation/application/handlers/CheckoutHandler.ts` — `handleAwaitingPayment` desvia para `AWAITING_CASH_CHANGE` quando `cash`; `confirmOrder` grava o troco e acrescenta a linha na confirmação; `buildConfirmingSummary` acrescenta o troco à linha de pagamento.
- `apps/api-quickcart/src/infra/container/index.ts` — instancia `CashChangeHandler` e registra os dois estados no `ConversationEngine`.

**Frontend (painel)**
- `apps/frontend-web/src/shared/api/api.types.ts` — `cashChangeForInCents` em `OrderDetail`.
- `apps/frontend-web/src/modules/admin/components/OrderDetailView.tsx` — linha "Troco para R$ X" no card de pagamento, só quando não é `null`.
- `apps/frontend-web/src/modules/preview/pages/OrderDetailPreview.page.tsx` — campo no pedido de exemplo (`null`).

**Testes**
- `apps/api-quickcart/src/modules/conversation/shared/parseCashAmountToCents.test.ts` (novo) — casos válidos (`150`, `150,00`, `R$ 150`, `150.00`, `1.500,00`, `1.500`) e inválidos (vazio, texto, negativo, zero).
- `apps/api-quickcart/src/modules/conversation/application/handlers/CashChangeHandler.test.ts` (novo) — "Não preciso" grava `null`; "Preciso de troco" pede o valor; valor ≤ total é recusado com a mensagem e repete a pergunta (sem mudar de estado); valor válido grava o troco e segue para o recibo; texto inválido não muda de estado.
- Testes existentes de `CreateOrderFromCart` e afins atualizados (`FakeOrderRepository`/fixtures) para o novo campo em `OrderRecord`.

### Decisões

- **Parser em arquivo próprio** (`shared/parseCashAmountToCents.ts`), não em `handlers/support/`: é regra de domínio pura reutilizável (mesma família de `formatPriceInCents`), sem dependência de handler.
- **`amountDue.ts` isolado**, hoje um passthrough do total do carrinho — é o gancho que a T2.1 troca para somar `delivery_fee_in_cents` sem tocar no `CashChangeHandler`.
- **Portas estreitas** no `CashChangeHandlerDependencies` (só os métodos usados de cada repositório/sender), seguindo o padrão já usado em `support/sendCategoryList.ts` — testável sem repositório completo.
- `checkoutCashChangeForInCents` usa **três estados** (ausente/`null`/número) em vez de dois, porque "ainda não perguntado" e "não precisa" são fatos diferentes.
- Nenhum log inclui o valor do troco (regra de PII, `security.md` §1) — a única leitura em log seria acidental, e não há `logger.*` tocando o contexto de checkout nesta task.

### Typecheck

- `cd apps/api-quickcart && bun run typecheck` → `tsc --noEmit`, sem erros.
- `cd apps/frontend-web && bun run typecheck` → `tsc --noEmit && tsc --noEmit -p tsconfig.test.json`, sem erros.

### Testes

- Baseline antes da mudança: **292 testes passando, 0 falhas** (api-quickcart).
- Depois da T1.1: **313 testes passando, 0 falhas** (api-quickcart) — 21 testes novos (14 do parser + `describe` de casos válidos/inválidos, mais os do `CashChangeHandler`).
- `apps/frontend-web`: **12 testes passando, 0 falhas** (sem testes novos nesta task — só tipos e um campo de exibição).

### Migration no banco de teste

- `quickcart-test-postgres` (porta 5443) já estava de pé; `quickcart-test-redis` idem.
- Aplicadas com `bun --env-file=envs/env.test run src/infra/database/migrate.ts` e `migrateCustomer.ts` (com `DATABASE_URL` apontando para `localhost:5443/quickcart_test` — o `env.test` tem valores com espaço sem aspas, e `bun --env-file` lida com isso; um `source` de shell puro quebra nessas linhas).
- Confirmado via `docker exec quickcart-test-postgres psql -U quickcart -d quickcart_test -c '\d orders'`: coluna `cash_change_for_in_cents | integer` presente.
- Script (`node -e`) confirmou `meta/_journal.json` com `idx` contíguo (0..20) e `when` estritamente crescente.

### Desvios da spec

Nenhum. O escopo da T1.1 foi implementado como descrito em `tasks.md`; a validação de "total a pagar" usa apenas o total dos itens, como a própria task instrui ("Até a T2.1 existir, `amountDue` = total dos itens").
