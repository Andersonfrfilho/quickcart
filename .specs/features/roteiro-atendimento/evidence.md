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

## T1.2 — Maquininha

### Arquivos alterados/criados

**Função pura**
- `apps/api-quickcart/src/modules/order/shared/requiresCardMachine.ts` (novo) — única função que decide `payment_method === card_on_delivery && delivery_type === delivery`, usando as constantes `PAYMENT_METHOD`/`DELIVERY_TYPE` de `Order.constant.ts` (nunca string literal).
- `apps/api-quickcart/src/modules/order/shared/requiresCardMachine.test.ts` (novo) — entrega+cartão = true; retirada+cartão = false; entrega+pix = false; entrega+dinheiro = false.

**Bot**
- `apps/api-quickcart/src/modules/conversation/shared/Messages.constant.ts` — nova constante `CHECKOUT_CARD_ON_DELIVERY_MACHINE_NOTICE` com o texto da spec §3.2.
- `apps/api-quickcart/src/modules/conversation/application/handlers/CheckoutHandler.ts` — `handleAwaitingPayment` envia a mensagem quando `buttonId === PAYMENT_METHOD_BUTTON_ID.CARD_ON_DELIVERY` **e** `checkoutContext.checkoutDeliveryType === DELIVERY_TYPE_BUTTON_ID.DELIVERY`, antes de seguir para `AWAITING_RECEIPT_PREFERENCE`. Não usa `requiresCardMachine` aqui porque o pedido ainda não existe nesse ponto do fluxo (é criado só em `confirmOrder`); a checagem equivalente é feita direto pelos dois valores já no contexto do checkout — `checkoutDeliveryType` é sempre setado antes de `AWAITING_PAYMENT` (`handleAwaitingDeliveryType`), então nunca chega indefinido aqui.
- `apps/api-quickcart/src/modules/conversation/application/handlers/CheckoutHandler.test.ts` (novo) — cobre os três casos: entrega+cartão (mensagem enviada), retirada+cartão (mensagem NÃO enviada), entrega+pix (mensagem NÃO enviada).

**Painel (backend — DTO)**
- `apps/api-quickcart/src/modules/order/infra/http/Order.controller.ts` — `withAllowedTransitions` (o único ponto de serialização de pedido para fora da api: lista, detalhe e todas as respostas de mutação) passa a exigir `paymentMethod` no tipo genérico e acrescenta `requiresCardMachine` ao DTO, calculado por `requiresCardMachine(order)`. Cobre automaticamente `handleListAdmin`, `handleGetAdminDetail`, `handleSetItemUnavailable`, `handleSetItemPicked`, `handleNotifyUnavailableItems` e `handleUpdateStatus` — nenhum lugar recalcula.
- `apps/api-quickcart/src/modules/order/infra/http/Order.controller.test.ts` (novo, e `withAllowedTransitions` passou a `export`) — confirma `requiresCardMachine` no DTO nos dois casos (entrega e retirada).

**Painel (frontend)**
- `apps/frontend-web/src/shared/api/api.types.ts` — `requiresCardMachine: boolean` em `Order` (herdado por `OrderDetail`).
- `apps/frontend-web/src/modules/admin/components/OrderDetailView.tsx` — selo "🧾 Levar maquininha" (`Badge variant="outline"`) no card de Pagamento, só quando `order.requiresCardMachine`.
- `apps/frontend-web/src/modules/admin/components/OrdersTableView.tsx` — mesmo selo, compacto ("🧾 Maquininha"), na coluna de tipo de entrega da lista.
- `apps/frontend-web/src/modules/preview/pages/OrderDetailPreview.page.tsx` e `OrdersPreview.page.tsx` — fixtures (pagamento Pix) ganham `requiresCardMachine: false` para satisfazer o tipo.

### Motorista

Não existe tela dedicada ao papel `motorista` no frontend — busquei por `driver`/`motorista` em `apps/frontend-web/src` e só encontrei o papel em `roles.constant.ts` (rótulo "Motorista" para exibição de equipe). Quem separa, entrega e administra usa as MESMAS telas (`OrderDetailView`, `OrdersTableView`) sob controle de permissão de rota/API — não há componente próprio de motorista para duplicar o selo. Como o selo foi colocado nesses componentes compartilhados, o motorista já o vê quando acessa o pedido pela mesma tela. Registrado aqui em vez de criar uma tela nova, como a task instrui.

### Decisões

- `requiresCardMachine` fica em `modules/order/shared/` (não em `handlers/support/`) porque é regra de domínio do pedido, reutilizada por api (DTO) e potencialmente pelo worker — mesma família de `Order.constant.ts`.
- O bot NÃO reusa `requiresCardMachine(order)` diretamente em `handleAwaitingPayment`: não há `order` ainda (é criado em `confirmOrder`, depois da preferência de recibo e do e-mail). A msg é disparada comparando os dois valores já escolhidos no checkout (`checkoutDeliveryType` e o botão de pagamento recém-clicado), que são os MESMOS dois campos que a função pura usa — não há duplicação de regra, só duplicação da comparação com valores ainda não persistidos.
- Retirada com cartão na entrega não recebe nenhuma mensagem sobre maquininha (nem texto alternativo): a spec diz que "não faz sentido" e não pede um texto substituto, e criar um inventaria uma regra de produto não pedida.
- `withAllowedTransitions` virou o ponto único de exposição de `requiresCardMachine` porque já era o ponto único de serialização de pedido pro DTO admin — reaproveitar evita um segundo lugar que poderia divergir.

### Typecheck

- `cd apps/api-quickcart && bun run typecheck` → `tsc --noEmit`, sem erros.
- `cd apps/frontend-web && bun run typecheck` → `tsc --noEmit && tsc --noEmit -p tsconfig.test.json`, sem erros.

### Testes

- Baseline antes da T1.2: **313 testes passando, 0 falhas** (api-quickcart), **12 passando, 0 falhas** (frontend-web).
- Depois da T1.2: **322 testes passando, 0 falhas** (api-quickcart) — 9 testes novos (4 do `requiresCardMachine`, 3 do `CheckoutHandler`, 2 do `withAllowedTransitions`). **12 passando, 0 falhas** (frontend-web) — sem testes novos, só tipos e selo visual.

### Desvios da spec

Nenhum desvio de comportamento. Um ajuste de escopo registrado: como não existe tela de motorista separada, o "mesmo selo" da task foi satisfeito pelos componentes compartilhados (`OrderDetailView`/`OrdersTableView`), e não por uma tela nova — a task pede explicitamente para não inventar uma quando não existir.

### T1.2 — ajuste na revisão

O bot reimplementava a regra da maquininha em vez de chamar `requiresCardMachine`, com o argumento de
que o pedido ainda não existe no checkout. A função já aceita `{ paymentMethod, deliveryType }`, e os
ids dos botões são os próprios valores de domínio, então o bot passou a usar a função. Suíte: 322
verdes; typecheck limpo.

## T1.3 — Previsão de entrega na confirmação

### Arquivos alterados

- `apps/api-quickcart/src/modules/conversation/application/handlers/CheckoutHandler.ts` —
  `confirmOrder` chama `buildDeliveryEstimateLine(order)` **depois** de `createOrderFromCartUseCase.execute`
  e acrescenta a linha (se houver) na confirmação, junto com a de troco. Novo método privado
  `buildDeliveryEstimateLine`: retirada usa `STORE_PREPARATION_MINUTES` direto, sem chamar a
  estimativa de rota; entrega chama `ResolveOrderDeliveryEstimateUseCase.execute({ order })` dentro de
  `try/catch` — **só** essa chamada fica protegida, nada mais no método. Sem estimativa, com
  `isOutsideRadius`, ou sem `minMinutes`/`maxMinutes`, a linha não aparece. Erro é logado com
  `checkoutLog.warn('delivery_estimate_unavailable', { orderId: order.id, error: serializeError(error) })`
  — só o `orderId`, nunca telefone/endereço/CEP.
- `apps/api-quickcart/src/modules/conversation/shared/Messages.constant.ts` — novas strings
  `ORDER_CONFIRMED_DELIVERY_ESTIMATE_LINE` ("Previsão de entrega: entre {min} e {max} minutos.") e
  `ORDER_CONFIRMED_PICKUP_ESTIMATE_LINE` ("Pronto para retirada em cerca de {minutos} minutos.").
- `apps/api-quickcart/src/infra/container/index.ts` — `ResolveOrderDeliveryEstimateUseCase` (já
  instanciado em `buildOrderModule` para o painel) passou a ser exposto no retorno do módulo
  (`OrderModule.resolveOrderDeliveryEstimateUseCase`), propagado por `ConversationModuleDependencies`
  e injetado no `CheckoutHandler`, junto com `storePreparationMinutes: environment.STORE_PREPARATION_MINUTES`
  — acesso pelo módulo de config validado, nunca `process.env` direto no handler.
- `apps/api-quickcart/src/modules/conversation/application/handlers/CheckoutHandler.deliveryEstimate.test.ts`
  (novo) — 5 casos: com `minMinutes`/`maxMinutes` a linha aparece; `undefined` some a linha; erro
  lançado não derruba a confirmação (e some a linha); fora do raio some a linha; retirada mostra a
  linha própria e **não** chama a estimativa de rota.

### Decisões

- `buildDeliveryEstimateLine` recebe `OrderRecord` (o pedido recém-criado), não recalcula nada do
  pedido — é o mesmo objeto que `createOrderFromCartUseCase.execute` devolveu.
- Dependência injetada **por interface**, no construtor do `CheckoutHandler`
  (`CheckoutHandlerDependencies.resolveOrderDeliveryEstimateUseCase`), sem `new` acoplado — a
  instância já existe no container (compartilhada com o painel via `GetAdminOrderDetailUseCase`).
- `storePreparationMinutes` entra como valor primitivo já resolvido do `environment.ts`, não como o
  módulo de config inteiro — o handler não precisa saber de mais nenhuma env.
- Retirada não passa pelo `try/catch` da estimativa porque não há chamada nenhuma a proteger: o
  número vem só da env.

### Chamadas externas por confirmação (auditoria da T4.1, registrado agora)

- `ResolveOrderDeliveryEstimateUseCase.execute` geocodifica **dois** CEPs por chamada: o da loja
  (`STORE_CEP`) e o do cliente. Cada geocodificação passa por `ResolveCepCoordinateUseCase`, que
  cacheia o resultado em Postgres via `DrizzleGeocodedAddressRepository` (mesmo comentário em
  `GetAdminOrderDetail.use-case.ts:51-53`: "só no primeiro pedido de cada CEP — depois vem do
  cache").
- Na prática: o CEP da loja é sempre o mesmo, então só a **primeira** confirmação do processo paga
  a geocodificação dele — as seguintes vêm do cache. O CEP do cliente paga geocodificação só na
  primeira vez que aquele CEP aparece (endereço novo).
- **Pior caso por confirmação:** até 2 chamadas ao provider de geocodificação (Nominatim), 0 no
  caso comum de loja já cacheada e cliente repetindo CEP. Nenhum cache foi adicionado nesta task —
  o que já existe (Postgres) é suficiente para o volume de uma confirmação e a decisão de ir além
  (ex.: cache em memória do CEP da loja) fica para a auditoria da T4.1.

### Typecheck

- `cd apps/api-quickcart && bun run typecheck` → `tsc --noEmit`, sem erros.

### Testes

- Baseline antes da T1.3: **322 testes passando, 0 falhas**.
- Depois da T1.3: **327 testes passando, 0 falhas** — 5 testes novos (`CheckoutHandler.deliveryEstimate.test.ts`).

### Migration no banco de teste

Nenhuma migration nova nesta task (T1.3 não adiciona coluna). `quickcart-test-postgres` e
`quickcart-test-redis` já estavam de pé e migrados até `0020`.

### Desvios da spec

Nenhum. O escopo foi implementado como descrito: previsão calculada depois de criar o pedido, linha
ausente sem estimativa/fora do raio/sem `STORE_CEP`, retirada com `STORE_PREPARATION_MINUTES`, e
falha na estimativa isolada por `try/catch` sem derrubar a confirmação.

## T1.1/T1.2 — correção: checkout lembrado pulava o troco e o aviso da maquininha

### Defeito

Em `CheckoutHandler.handleAwaitingDeliveryType`, o atalho lembrado (`REMEMBERED_CHECKOUT_BUTTON_ID.SAME_AS_LAST`,
"Isso mesmo") aplicava em bloco entrega, endereço, pagamento, recibo e e-mail do último pedido e ia
direto para `enterConfirming`. Duas consequências:

1. Pagamento lembrado **dinheiro**: a pergunta do troco (T1.1) era pulada. O pedido nascia sem
   `checkoutCashChangeForInCents`, e o entregador podia sair sem troco. Reaproveitar o valor do
   pedido anterior também seria errado — o troco depende do total DESTA compra, não da anterior.
2. Pagamento lembrado **cartão na entrega + entrega**: o aviso da maquininha (T1.2) também não era
   enviado — menos grave, mas o entregador podia sair sem saber que precisava levar a máquina.

### Causa

O atalho lembrado tratava as quatro escolhas (entrega, endereço, pagamento, recibo) como um bloco
atômico que só precisava ser copiado para o contexto e confirmado — sem passar pelas mesmas
ramificações (`cash` → troco, `card_on_delivery` + `delivery` → aviso) que o caminho longo já tinha
em `handleAwaitingPayment`.

### Correção

- `CheckoutHandler.handleAwaitingDeliveryType`: o atalho lembrado agora verifica o pagamento
  lembrado antes de confirmar. Se for `cash`, entra em `AWAITING_CASH_CHANGE` com todo o resto do
  contexto lembrado já preenchido (entrega, endereço, recibo, e-mail) — a pergunta do troco é
  refeita, o resto não. Se `requiresCardMachine` (mesma função de sempre, painel e motorista) for
  verdadeira, envia o aviso da maquininha antes de confirmar. Pix (e qualquer outro meio) confirma
  direto, como antes.
- `CashChangeHandler`: ao terminar o fluxo do troco ("Não preciso" ou valor válido), se o contexto
  já tem `checkoutReceiptPreference` (veio do atalho lembrado), vai direto para a confirmação —
  não pergunta o recibo de novo. Sem essa memória (fluxo normal com dinheiro), continua perguntando
  o recibo como sempre.
- **Extração compartilhada**: `enterConfirming` + `buildConfirmingSummary` (privados no
  `CheckoutHandler`) viraram uma função só, em
  `apps/api-quickcart/src/modules/conversation/application/handlers/support/enterConfirming.ts`,
  usada pelos dois handlers — nenhuma lógica de montagem do resumo foi duplicada. Dependências por
  portas estreitas (`EnterConfirmingDependencies`), no mesmo estilo que o `CashChangeHandler` já
  usava; `CashChangeHandlerDependencies` passou a ser esse mesmo tipo.
- Wiring: nenhuma mudança no `container/index.ts` — `CashChangeHandler` já recebia exatamente as
  quatro dependências (`conversationSessionRepository`, `whatsAppSender`, `cartRepository`,
  `productRepository`) que `EnterConfirmingDependencies` exige.

### Arquivos

- `apps/api-quickcart/src/modules/conversation/application/handlers/support/enterConfirming.ts`
  (novo) — `enterConfirming` + `buildConfirmingSummary` extraídos do `CheckoutHandler`.
- `apps/api-quickcart/src/modules/conversation/application/handlers/CheckoutHandler.ts` — atalho
  lembrado corrigido; métodos privados de confirmação removidos, chamando a função compartilhada.
- `apps/api-quickcart/src/modules/conversation/application/handlers/CashChangeHandler.ts` — decide
  entre confirmar direto ou perguntar o recibo, conforme `checkoutReceiptPreference` já presente.
- `apps/api-quickcart/src/modules/conversation/application/handlers/CheckoutHandler.rememberedCheckout.test.ts`
  (novo) — 4 casos: dinheiro lembrado pergunta troco; cartão+entrega lembrado avisa a maquininha e
  confirma; cartão+retirada lembrado não avisa; pix lembrado confirma direto.
- `apps/api-quickcart/src/modules/conversation/application/handlers/CashChangeHandler.test.ts` —
  2 casos novos: "Não preciso" e valor válido, ambos com `checkoutReceiptPreference` já no
  contexto, vão direto à confirmação sem perguntar o recibo. Ajuste no fixture de
  `productRepository.findById` para incluir `name` (exigido por `EnterConfirmingDependencies`).

### Typecheck

`cd apps/api-quickcart && bun run typecheck` → `tsc --noEmit`, sem erros.

### Testes

- Baseline antes desta correção: **327 testes passando, 0 falhas**.
- Depois da correção: **333 testes passando, 0 falhas** — 6 testes novos (4 no
  `CheckoutHandler.rememberedCheckout.test.ts`, 2 no `CashChangeHandler.test.ts`).

### Desvios da spec

Nenhum. O fluxo normal (pagamento em dinheiro sem atalho lembrado) continua perguntando o recibo
depois do troco, exatamente como antes desta correção.

## T2.1 — Taxa de entrega

Plano seguido: `t2.1-validacao-architect.md` (aprovado com ajustes; amplia o `tasks.md`).
Commits: `13cfa17` (api + migration), `4ccb8e0` (worker), `c418194` (web).

### Arquivos

**api-quickcart**
- `src/infra/config/environment.ts` — `DELIVERY_FEE_CENTS: z.coerce.number().int().nonnegative().default(0)`.
- `envs/env.dev`, `.env.example` — `DELIVERY_FEE_CENTS=0` com aviso do contador.
- `drizzle/migrations/0021_order_delivery_fee.sql` + `meta/_journal.json` (idx 21).
- `src/infra/database/schema/orders.ts` — `deliveryFeeInCents` (`delivery_fee_in_cents integer not null default 0`).
- `src/modules/order/shared/amountDue.ts` (novo) — `resolveDeliveryFeeInCents` e `amountDueInCents`.
  `conversation/application/handlers/support/amountDue.ts` **removido**.
- `order/domain/OrderRepository.interface.ts`, `order/infra/database/DrizzleOrderRepository.ts` —
  `OrderRecord.deliveryFeeInCents`; `createWithStockDecrement` grava `params.deliveryFeeInCents` (não decide).
- `order/application/use-cases/CreateOrderFromCart.use-case.ts` (+ types) — recebe `quotedDeliveryFeeInCents`.
- `order/application/use-cases/CreateWebOrder.use-case.ts` — dependência `configuredDeliveryFeeInCents`.
- `infra/container/index.ts`, `infra/http/server.ts`, `infra/database/seeds/OrderSeedRunner.ts` — wiring da env.
- `conversation/shared/ConversationContext.types.ts` — `checkoutDeliveryFeeInCents`.
- `conversation/application/handlers/CheckoutHandler.ts` — cota a taxa ao escolher entrega/retirada e no
  atalho lembrado; `confirmOrder` repassa a do contexto; confirmação ganha `Total: {amountDue}`.
- `conversation/application/handlers/CashChangeHandler.ts` — troco contra itens + taxa do contexto.
- `order/shared/customerDecisionMessage.ts`, `GlobalHandler.ts`, `registerQuickCartFlowActions.ts` — amountDue.
- `order/infra/http/Order.controller.ts` — DTO ganha `amountDueInCents` (`deliveryFeeInCents` já vem do record).
- `store/infra/http/Store.controller.ts`, `StoreRoutes.ts` — "Meus pedidos" com `amountDueInCents`;
  rota nova `GET /v1/store/checkout-config`.
- `conversation/shared/Messages.constant.ts` — `ORDER_CONFIRMED_TOTAL_LINE`.

**worker-quickcart**
- `infra/database/schema/orders.ts` — coluna.
- `receipt/.../DrizzleOrderReceiptRepository.ts`, `OrderReceiptData.types.ts`, `ReceiptProvider.interface.ts`,
  `ProcessReceiptJob.use-case.ts` — repassam `deliveryFeeInCents`.
- `receipt/infra/providers/SimpleReceiptProvider.ts` — subtotal, taxa ("grátis" se 0, ausente na retirada) e
  total cobrado. `shared/amountDue.ts` (espelho), `receipt/shared/Receipt.constant.ts`, `DELIVERY_TYPE` no
  `shared/Order.constant.ts`.
- `FiscalReceiptProvider.ts` — **não alterado**.

**frontend-web**
- `shared/api/api.types.ts` — `Order.deliveryFeeInCents`, `Order.amountDueInCents`, `CheckoutConfig`.
- `shared/api/client.ts`, `store/shared/queries/useCheckoutConfig.query.ts` — leitura da config.
- `store/hooks/useCheckoutPage.hook.ts`, `store/pages/Checkout.page.tsx` — linha da taxa antes de confirmar.
- `admin/components/OrderDetailView.tsx` (Total = amountDue, com itens e taxa; recado de novo total),
  `OrdersTableView.tsx`, `store/pages/MyOrders.page.tsx` — exibem amountDue.
- `shared/order/deliveryFee.constant.ts` — rótulos repetidos; previews com taxa de exemplo.

### Decisões

1. **Taxa cotada uma vez no WhatsApp (risco 3 do architect).** O `CheckoutHandler` resolve a taxa
   (`resolveDeliveryFeeInCents` com a env) no momento em que o tipo de entrega é escolhido — inclusive no
   atalho "Isso mesmo" — e grava `checkoutDeliveryFeeInCents` no contexto. `CashChangeHandler` e
   `confirmOrder` usam esse valor; a env não é relida. `CreateOrderFromCart` recebe
   `quotedDeliveryFeeInCents` e ainda passa por `resolveDeliveryFeeInCents` (retirada = 0 continua garantido
   no use case, sem duplicar a regra). Sessão anterior ao deploy, sem o campo, vale 0 (o padrão da env).
2. **Web lê a env no use case** (`configuredDeliveryFeeInCents` injetado): não há etapa anterior que
   congele a taxa. O seed herda a mesma via `environment.DELIVERY_FEE_CENTS` (0 em `env.dev`).
3. **Exposição da taxa na web: `GET /v1/store/checkout-config`**, pública, no `StoreController` que já
   serve a loja. Devolve `{ data: { deliveryFeeInCentsByDeliveryType: { delivery, pickup } } }`, cada
   valor calculado por `resolveDeliveryFeeInCents` — a tela só consulta, não reimplementa "retirada = 0".
   Por que não uma prévia do checkout: exigiria mandar o carrinho e duplicaria a validação do
   `CreateWebOrder`; a config pública é uma leitura sem dado de cliente. Sem `VITE_` duplicado.
4. **Checkout web mostra Subtotal + Taxa, não o total somado.** Somar na tela seria a segunda cópia de
   `amountDueInCents`; o resumo com total é da T2.2. A linha antes rotulada "Total" virou "Subtotal".
5. **Confirmação do WhatsApp ganhou `Total: R$ X.`** com `amountDueInCents(order)` — antes não mostrava
   total nenhum; a spec pede o valor cobrado na confirmação.
6. **Worker espelha `amountDueInCents`** em `shared/amountDue.ts`, no mesmo padrão do `Order.constant.ts`
   espelhado: os dois processos não compartilham código.
7. **Ordenação por total segue pelos itens** (`Order.constant.ts`, `ListOrders.types.ts`,
   `OrderRepository.interface.ts`, `OrdersTableView` linha do cabeçalho); a coluna exibe o cobrado. Com
   taxa fixa por pedido, a ordem só diverge entre entrega e retirada de valores próximos. Aceito.
8. **`z.coerce.number()` aceita `""` como 0** — aceitável (0 é o padrão seguro).

### Consumidores de `totalInCents` (conferidos contra a tabela do architect)

Todos os marcados **amountDue** foram migrados: `customerDecisionMessage.ts` (aviso e pergunta),
`GlobalHandler` `{total}` da troca, histórico (`registerQuickCartFlowActions`), confirmação
(`CheckoutHandler`), troco (`CashChangeHandler`), `OrderDetailView` (card Total e recado), `OrdersTableView`,
`MyOrders.page`, recibo simples. Seguem com itens, por decisão: schema, criação/falta/substituição no
repositório, ordenação, `itemSubstitutionMessage` (diferença entre itens), `CartSummary` (carrinho — o rótulo
"Subtotal" no WhatsApp fica com a T2.2, junto do resumo), linhas de item, `cartStore`/`Cart.page`,
`FiscalReceiptProvider` (**não mexido**). Tela do motorista: não exibe valor.

### Migration

- Journal verificado por script (`check-journal.py` no scratchpad): 22 entradas, `idx` contíguo 0..21,
  `when` estritamente crescente (21: `1790036900738` > 20: `1790034492528`, epoch em ms real), todos os
  `.sql` existem.
- Aplicada no banco de teste (`migrate.ts` + `migrateCustomer.ts`, `DATABASE_URL` da porta 5443):
  `delivery_fee_in_cents | integer | NOT NULL | default 0` em `information_schema.columns`.

### Typecheck

`bun run typecheck` limpo em api-quickcart, worker-quickcart e frontend-web.

### Testes (`bun run test`)

| app | antes | depois |
|---|---|---|
| api-quickcart | 333 | **351** (0 falhas) |
| worker-quickcart | 14 | **19** (0 falhas) |
| frontend-web | 12 | **12** (0 falhas) |

Novos: `amountDue.test.ts` (soma; retirada = 0); `CreateOrderFromCart`/`CreateWebOrder` (taxa gravada na
entrega, 0 na retirada, fora do total); `DrizzleOrderRepository.deliveryFee.integration.test.ts` (banco real:
taxa na coluna, `total_in_cents == soma dos order_items` — falha se a taxa entrar no total —, nenhuma linha de
item para a taxa, falta e substituição recalculam o total e preservam a taxa, retirada = 0);
`CheckoutHandler.deliveryFee.test.ts` (cota ao escolher; retirada 0; `confirmOrder` usa a do contexto mesmo
com a env mudada; confirmação mostra itens + taxa); `CashChangeHandler` (troco recusado contra itens + taxa,
aceito acima); `Order.controller.test` (`amountDueInCents` no DTO); worker `FiscalReceiptProvider.test.ts`
(taxa 800: pagamento e `totalAmount` da NFC-e == soma dos itens) e `SimpleReceiptProvider.test.ts`.

### ⚠️ Risco fiscal — levar ao contador antes de `DELIVERY_FEE_CENTS > 0`

Com taxa ligada, o cliente paga itens + taxa, mas a NFC-e registra só os itens (sem grupo de frete,
`modFrete = 9`). Falta definir como a taxa é documentada (serviço à parte, recibo, etc.). Com o padrão `0`
nada muda no fiscal. Nenhum env commitado liga a taxa.

### Desvios / pendências

- Checkout web sem linha de total somado (decisão 4) — entra na T2.2.
- `CART_SUMMARY_TOTAL_PREFIX` ("Total:") do carrinho no WhatsApp não foi renomeado para "Subtotal": o
  architect marca o carrinho como itens, e a troca de rótulo acompanha o resumo da T2.2.
- `GET /v1/store/checkout-config` sem teste de controller dedicado (a regra que ele usa é testada em
  `amountDue.test.ts`).

## T2.2 — Resumo completo

### Arquivos

**api-quickcart**
- `src/modules/conversation/shared/Messages.constant.ts` — `CART_SUMMARY_TOTAL_PREFIX` vira
  "Subtotal:" (pendência da T2.1); novas constantes `CONFIRMING_SUMMARY_ITEMS_LABEL`,
  `CONFIRMING_SUMMARY_SUBTOTAL_PREFIX`, `CONFIRMING_SUMMARY_DELIVERY_FEE_PREFIX`,
  `CONFIRMING_SUMMARY_DELIVERY_FEE_FREE`, `CONFIRMING_SUMMARY_TOTAL_PREFIX`,
  `CONFIRMING_SUMMARY_DELIVERY_PREFIX`, `CONFIRMING_SUMMARY_PICKUP_LABEL`,
  `CONFIRMING_SUMMARY_PAYMENT_PREFIX`, `CONFIRMING_SUMMARY_RECEIPT_PREFIX`.
- `conversation/application/handlers/support/enterConfirming.ts` — `buildConfirmingSummary`
  reescrita no formato exato da spec §3.4: Itens, Subtotal, Taxa de entrega ("grátis" quando 0,
  ausente na retirada), Total (`amountDueInCents`), Entrega/Retirada, Pagamento (com troco),
  Recibo. Taxa lida de `checkoutContext.checkoutDeliveryFeeInCents` (gravada pela T2.1), nunca da
  env.
- `conversation/application/handlers/support/enterConfirming.test.ts` (novo) — 4 casos: entrega com
  taxa, entrega grátis, retirada (sem linha de taxa), dinheiro com troco.
- `conversation/application/handlers/support/CartSummary.test.ts` (novo) — confirma "Subtotal:" e
  ausência de "Total:" no carrinho.
- `order/shared/buildPricedOrderItems.ts` (novo) — extraído de `CreateWebOrder.buildOrderItems`:
  preço/validação de item SEMPRE do banco (nunca do corpo/carrinho local). Reaproveitado pela
  cotação, em vez de duplicar a leitura.
- `order/application/use-cases/CreateWebOrder.use-case.ts` — `buildOrderItems` delega para
  `buildPricedOrderItems`; import de `ProductNotFoundError`/`CartProductUnavailableError` removido
  (a função os lança).
- `store/shared/Store.constant.ts` — `CHECKOUT_QUOTE_MAX_ITEMS = 100`.
- `store/infra/http/schemas/CheckoutQuote.schema.ts` (novo) — `items` (1..100, `productId` uuid,
  `quantity` positiva), `deliveryType` (enum).
- `store/infra/http/Store.controller.ts` — `handleGetCheckoutConfig` **removido**;
  `handleGetCheckoutQuote` (novo): lê preço do banco via `buildPricedOrderItems`, taxa via
  `resolveDeliveryFeeInCents`, total via `amountDueInCents`; devolve
  `{ subtotalInCents, deliveryFeeInCents, amountDueInCents, items[] }`. Pública, sem `requireSession`
  (mesmo padrão do antigo `checkout-config`).
- `store/infra/http/Store.controller.test.ts` (novo) — preço do banco (ignora o do corpo), taxa por
  tipo de entrega, total = amountDue, produto inexistente (`ProductNotFoundError`), corpo inválido
  (`ValidationError`), limite de itens (`ValidationError`).
- `store/infra/http/StoreRoutes.ts` — `GET /v1/store/checkout-config` → `POST
  /v1/store/checkout-quote`.
- `infra/container/index.ts` — `storeRepositories.productRepository` (novo), reaproveitando
  `catalogModule.productRepository` já montado.
- `infra/http/server.ts` — `StoreController` recebe `productRepository` do container.

**frontend-web**
- `shared/api/api.types.ts` — `CheckoutConfig` removido; `CheckoutQuote`, `CheckoutQuoteItem`,
  `CheckoutQuoteInput` novos.
- `shared/api/client.ts` — `getCheckoutConfig` → `getCheckoutQuote(body)` (`POST`).
- `store/shared/queries/useCheckoutConfig.query.ts` **removido**; `useCheckoutQuote.query.ts` (novo)
  — chave inclui `deliveryType` + `items`, recota a cada mudança do carrinho ou do tipo de entrega.
- `store/hooks/useCheckoutPage.hook.ts` — expõe `quote` (a cotação inteira) em vez de só
  `deliveryFeeInCents`.
- `store/pages/Checkout.page.tsx` — Subtotal, Taxa e **Total** vêm da cotação (`quote`); o subtotal
  exibido é o do servidor (`quote.subtotalInCents`), não a soma local do carrinho, para nunca mostrar
  um valor diferente do que será cobrado quando o preço do banco divergir do carrinho salvo no
  navegador.

### Decisões

1. **`GET /v1/store/checkout-config` removido.** A cotação (`POST /v1/store/checkout-quote`) cobre o
   mesmo caso — taxa por tipo de entrega, pela mesma `resolveDeliveryFeeInCents` — e resolve também o
   requisito que faltava (mostrar o Total antes de confirmar). Manter os dois endpoints seria duas
   fontes de taxa que poderiam divergir se um mudasse e o outro não; a task pediu para avaliar essa
   sobreposição e decidir, e a decisão foi remover o mais antigo. Nenhum outro consumidor restou
   (`useCheckoutConfigQuery` era o único).
2. **Preço da cotação reaproveita `CreateWebOrder`, via `buildPricedOrderItems`.** A lógica de
   "ler produto no banco, recusar inexistente/indisponível, calcular linha" era idêntica nos dois
   lugares; extrair evita a leitura de preço divergir entre a prévia (cotação) e a criação real do
   pedido — o próprio requisito da task ("verificar se a cotação reaproveita a mesma leitura").
3. **Erros da cotação seguem os já existentes do domínio (`ProductNotFoundError` 404,
   `CartProductUnavailableError` 409)**, em vez de introduzir 400/422 novos para o mesmo caso: o
   `apis.md` já padroniza 404 para "não encontrado" e 409 para conflito de estado, e esses dois
   erros já são o padrão do projeto para produto inexistente/indisponível (usados por
   `CreateWebOrder`, `AddCartItem` etc.). Corpo malformado (schema Zod) continua caindo em
   `ValidationError` → 400, que é o padrão para entrada inválida. Registrado aqui porque a task
   sugeria 400/422 especificamente para produto recusado.
4. **Limite de itens só por schema (`.max(100)`), sem limite de tamanho de corpo em bytes.** Não há
   middleware de `bodyLimit` no projeto (nenhum outro endpoint declara um); criar um só para esta
   rota seria inventar infraestrutura fora do escopo da task. Com 100 itens no máximo e payload por
   item pequeno (dois campos), o corpo já fica limitado a um tamanho pequeno na prática.
5. **`checkoutDeliveryFeeInCents` do contexto, nunca a env, no resumo do WhatsApp** — mesma regra do
   risco 3 do architect na T2.1: se `DELIVERY_FEE_CENTS` mudar entre a escolha do tipo de entrega e a
   confirmação, o resumo mostrado ao cliente e o valor cobrado em `confirmOrder` continuam batendo.
6. **Formato do resumo segue a spec §3.4 literalmente** (`Itens:`, `Subtotal:`, `Taxa de entrega:`,
   `Total:`, `Entrega:`/retirada, `Pagamento:`, `Recibo:`), diferente do formato anterior (sem
   rótulos em "Entrega"/"Pagamento"/"Recibo", com 📍 solto). Os emojis dos botões (🚚/🏪, 💳/💵,
   📱/📧) continuam aparecendo dentro da linha, como já faziam.

### Typecheck

- `cd apps/api-quickcart && bun run typecheck` → `tsc --noEmit`, sem erros.
- `cd apps/frontend-web && bun run typecheck` → `tsc --noEmit && tsc --noEmit -p tsconfig.test.json`,
  sem erros.

### Testes

- Baseline antes da T2.2: **351 passando** (api-quickcart), **12 passando** (frontend-web), **19
  passando** (worker-quickcart, não tocado nesta task).
- Depois da T2.2: **361 passando, 0 falhas** (api-quickcart) — 10 testes novos (4 `enterConfirming`,
  1 `CartSummary`, 5 `Store.controller`/checkout-quote). **12 passando, 0 falhas** (frontend-web —
  sem teste de componente novo: não havia harness de teste de página antes desta task, e criar um só
  para isto seria escopo além do pedido). **19 passando** (worker-quickcart, inalterado).
- Banco de teste: `quickcart-test-postgres`/`quickcart-test-redis` já estavam de pé e migrados até
  0021 (herdado da T2.1); nenhuma migration nova nesta task.

### Desvios da spec

- Nenhum desvio de comportamento do resumo (formato bate com a spec §3.4 literalmente).
- `GET /v1/store/checkout-config` removido em vez de mantido — decisão registrada acima, dentro do
  que a task pediu para avaliar.

### T2.2 — ajuste na revisão: N+1 na cotação pública

`buildPricedOrderItems` fazia um `findById` por item, em série. O padrão já existia no
`CreateWebOrder`, mas a T2.2 o expôs em `POST /v1/store/checkout-quote`, rota **pública** que o
checkout web recota a cada mudança no carrinho — 100 itens anônimos viravam 100 consultas por
requisição. Agora é um `findByIds` (uma consulta, `inArray`). A cotação ganhou teto de 999 por linha.

- Teste novo afirma `findById: 0, findByIds: 1` para 50 itens; verificado contra o código antigo: reprova.
- Um dublê do controller era `as never` e não acusou o método novo no typecheck — só a suíte pegou.
  Tipar dublês com `as never` esconde exatamente esse tipo de quebra.
- Suíte da api: 369 verdes (361 + 8 novos).

## T2.3 — Botão Alterar

### Arquivos

- `apps/api-quickcart/src/modules/conversation/shared/Messages.constant.ts` —
  `CONFIRMING_BUTTON_ID.EDIT = 'edit_order'`; `CONFIRMING_BUTTONS` ganha o botão
  `{ id: EDIT, title: '✏️ Alterar' }` entre Confirmar e Cancelar (3 botões, dentro do limite do
  WhatsApp; título com 10 caracteres, na mesma faixa de "✅ Confirmar"/"❌ Cancelar").
- `apps/api-quickcart/src/modules/conversation/application/handlers/CheckoutHandler.ts` —
  `handleConfirming` trata `CONFIRMING_BUTTON_ID.EDIT` chamando o novo método privado
  `alterCheckout`. Ele muda o estado para `CART_REVIEW` e reaproveita `sendCartSummary` (a mesma
  função que `CartHandler` usa para mostrar o carrinho) — nenhuma montagem de resumo duplicada.
  Nada escreve no `cartRepository`: o carrinho persistido não é tocado, só o estado da conversa.
- `apps/api-quickcart/src/modules/conversation/application/handlers/CartHandler.ts` —
  `handleCartReview`, ao clicar "Fechar pedido", passa a checar `session.context.rememberedCheckout`
  ANTES de consultar `resolveRememberedCheckout` (última compra no banco).
- `apps/api-quickcart/src/modules/conversation/application/handlers/CheckoutHandler.alterCheckout.test.ts`
  (novo) — "Alterar" muda para `cart_review` preservando o checkout escolhido como
  `rememberedCheckout` (sem apagar carrinho); carrinho vazio avisa e não quebra.
- `apps/api-quickcart/src/modules/conversation/application/handlers/CartHandler.rememberedCheckout.test.ts`
  (novo) — com `rememberedCheckout` já na sessão, `handleCartReview` o usa direto e NÃO chama
  `orderRepository.findLastByCustomer`.

### Decisão sobre o `rememberedCheckout` (investigação pedida pela task)

`toRememberedCheckout` (`rememberedCheckout.ts`) monta a memória a partir do **último pedido
confirmado no banco** (`orderRepository.findLastByCustomer`), consultado só quando o cliente entra
em `cart_review` e aperta "Fechar pedido" (`CartHandler.handleCartReview`). No fluxo de "Alterar", o
cliente está voltando ANTES de qualquer pedido novo existir — o último pedido no banco ainda é o de
uma compra anterior (ou nenhum), não o que ele acabou de escolher nesta sessão. Reaproveitar
`toRememberedCheckout`/`findLastByCustomer` aqui ofereceria a escolha errada (ou nenhuma).

**Decisão:** ao clicar "Alterar", `CheckoutHandler.alterCheckout` monta o `rememberedCheckout`
**diretamente do `checkoutContext` da sessão** (o mesmo formato de `ConversationContext['rememberedCheckout']`:
`deliveryType`, `address?`, `paymentMethod`, `receiptPreference`, `email?`) e grava no contexto do
novo estado `CART_REVIEW`. `CartHandler.handleCartReview` passa a preferir esse valor de sessão ao
"Fechar pedido" de novo, só caindo para `resolveRememberedCheckout` (banco) quando a sessão não
carrega nenhum. Isso reaproveita o MESMO atalho "Isso mesmo" e o MESMO caminho de
`handleAwaitingDeliveryType` já corrigido (commit 02b01dd) — nada foi contornado:
- Pagamento lembrado **dinheiro** → `AWAITING_CASH_CHANGE` de novo (o troco depende do total DESTA
  compra, que pode ter mudado com a alteração do carrinho).
- `checkoutDeliveryFeeInCents` é **recotado** por `quoteDeliveryFeeInCents(remembered.deliveryType)`
  a partir do contexto atual, nunca copiado direto do valor antigo.
- Pagamento lembrado **cartão na entrega + entrega** → aviso da maquininha reenviado.

Nenhuma duplicação de lógica: `alterCheckout` só monta o objeto e reusa `sendCartSummary`;
`handleAwaitingDeliveryType` continua sendo o único lugar que decide o que fazer com um
`rememberedCheckout`, seja ele vindo do banco (repetir última compra) ou da sessão (Alterar).

### Cancelar

Sem mudança — `CONFIRMING_BUTTON_ID.CANCEL` continua indo para `GREETING` com `MESSAGES.ORDER_CANCELLED`,
como antes.

### Typecheck

`cd apps/api-quickcart && bun run typecheck` → `tsc --noEmit`, sem erros. Frontend não tocado nesta
task (nenhum arquivo de `apps/frontend-web` mudou).

### Testes

- Baseline antes da T2.3: **369 testes passando, 0 falhas** (api-quickcart).
- Depois da T2.3: **372 testes passando, 0 falhas** — 3 testes novos (2 em
  `CheckoutHandler.alterCheckout.test.ts`, 1 em `CartHandler.rememberedCheckout.test.ts`).
- Banco de teste: `quickcart-test-postgres`/`quickcart-test-redis` já estavam de pé; migrations
  rodadas de novo (`migrate.ts` + `migrateCustomer.ts` com `--env-file=../../envs/env.test`) — nenhuma
  migration nova nesta task (T2.3 não mexe em coluna nem tabela).
- Dublês de teste tipados com `as unknown as <Dependencies>` sobre um objeto literal completo (mesmo
  padrão já usado em `CheckoutHandler.rememberedCheckout.test.ts`), nunca `as never` — o typecheck
  acusa método faltando na interface.

### Desvios da spec

Nenhum. Confirmar/Cancelar mantidos como estavam; "Alterar" foi o único botão novo, e o
reaproveitamento de entrega/pagamento ao fechar de novo passa pelo mesmo caminho corrigido em
02b01dd, incluindo repetir a pergunta do troco e recotar a taxa de entrega.

### T2.3 — correção: memória sobrevive à edição do carrinho

**Defeito.** A T2.3 (c8073aa) fazia "Alterar" guardar `rememberedCheckout` no contexto e
`CartHandler.handleCartReview` priorizá-lo ao "Fechar pedido". Mas quem aperta "Alterar" quer
mudar o CARRINHO, e as transições do ciclo de montagem/edição gravavam `context: {}` (ou um
objeto novo sem `rememberedCheckout`), apagando a memória junto:
- `CartHandler.ts`: "Adicionar mais" (`handleCartReview`, `ADD_MORE`), `sendEditingCartList`
  (as duas saídas: carrinho vazio e listagem normal) e `returnToCartReview` ("Concluir edição").
- `enterCartReview.ts` (ponto único de entrada em `cart_review`, usado por `advanceResolutionQueue`
  e por `BrowseHandler`): gravava `context: { unmatchedTerms: [] }`.
- `advanceResolutionQueue.ts`: ao abrir `RESOLVING_ITEMS` (fila de desambiguação), gravava só
  `{ cartDraft, unmatchedTerms, pendingResolutions }`.

Resultado: Alterar → editar/adicionar item → voltar ao carrinho → Fechar pedido perdia a memória,
e `handleCartReview` caía no `resolveRememberedCheckout` (último pedido do banco) — outra compra,
ou nada para cliente novo. O critério 7 só funcionava no caso inútil de "Alterar" sem mexer em
nada.

**Causa.** Cada transição do ciclo escrevia o contexto do zero (ou reconstruía só os campos que
lhe interessavam) em vez de carregar adiante o que já estava lá.

**Correção.** Uma função única,
`carryRememberedCheckout(context): Pick<ConversationContext, 'rememberedCheckout'>`
(`apps/api-quickcart/src/modules/conversation/application/handlers/support/carryRememberedCheckout.ts`),
devolve `{ rememberedCheckout }` quando existir no contexto de origem, e `{}` quando não. Usada em:
- `CartHandler.ts`: `handleCartReview` (`ADD_MORE`, linha ~150), `sendEditingCartList` (linhas
  ~239 e ~254) e `returnToCartReview` (linha ~277). A transição de editar item em si
  (`handleEditingCart`, linha ~194, que grava `editingCartItemId`) já espalhava `...context`
  inteiro e não precisou de mudança — só ganhou o `rememberedCheckout` de graça por já preservar
  o contexto todo.
- `enterCartReview.ts` (linha ~87): `context: { unmatchedTerms: [], ...carryRememberedCheckout(sessionContext) }`.
- `advanceResolutionQueue.ts` (linha ~83): `context: { cartDraft, unmatchedTerms, pendingResolutions, ...carryRememberedCheckout(sessionContext) }`.

Só `rememberedCheckout` é carregado — nenhuma outra chave de checkout (`checkoutDeliveryType`,
`checkoutPaymentMethod`, `checkoutCashChangeForInCents` etc.) atravessa o ciclo de edição; quem
decide se o reaproveitamento vale é a pergunta "Isso mesmo?" em `handleAwaitingDeliveryType`
(não tocado nesta correção), igual à T2.3 original.

Fora do ciclo de montagem/edição nada mudou: `GlobalHandler`, `CheckoutHandler`, `MenuHandler`,
`GreetingHandler` e `enterConfirming` continuam gravando `context: {}` nas saídas por
sair/cancelar, conclusão de pedido e expiração — verificado que nenhum desses grep-a `context: {}`
foi tocado.

**Testes novos**, sem `as never` (dublês tipados por `as unknown as <Dependencies>` sobre objeto
literal, mesmo padrão do resto do arquivo):
- `CartHandler.rememberedCheckoutSurvivesEditing.test.ts` (5 casos): "Adicionar mais" preserva;
  "Editar carrinho" preserva; "Concluir edição" preserva; escolher item para editar preserva
  (`editingCartItemId` + `rememberedCheckout`); sem `rememberedCheckout` prévio, não inventa memória.
- `support/enterCartReview.rememberedCheckout.test.ts` (4 casos): `enterCartReview` isolado
  preserva; caminho completo "Adicionar mais → lista → cart_review" via `advanceResolutionQueue`
  preserva; caminho com `RESOLVING_ITEMS` (desambiguação pendente) preserva; sem memória prévia,
  não inventa.
- Invariantes do troco/taxa de entrega (commit 02b01dd, T2.1) não foram tocados — cobertura
  existente em `CheckoutHandler.rememberedCheckout.test.ts` continua verde sem alteração.

**Números.** Baseline antes desta correção: 372 testes passando, 0 falhas. Depois: **381 testes
passando, 0 falhas** (9 novos: 5 + 4 acima). `bun run typecheck` limpo.

## T3.1 — Palavra-chave de atendente

**Arquivos novos:**
- `apps/api-quickcart/src/modules/conversation/shared/isHumanHandoffRequest.ts` — função pura.
  Normaliza (minúsculas, NFD sem diacríticos, remove pontuação, colapsa espaços) e casa a
  **mensagem inteira** contra `HUMAN_HANDOFF_PHRASES`, ou contra o prefixo "quero falar com" /
  "preciso falar com" / "falar com" seguido de artigo opcional (um/uma/o/a) + `atendente` /
  `humano` / `pessoa` / `alguém`.
- `apps/api-quickcart/src/modules/conversation/application/handlers/support/requestHumanHandoff.ts`
  — ação compartilhada: se `findByPhone` mostrar `humanRequestedAt` já preenchido, responde
  `MESSAGES.AGENT_ALREADY_WAITING` e não toca no banco; caso contrário chama
  `conversationSessionRepository.requestHuman` e responde `MESSAGES.AGENT_REQUESTED`. Usada por:
  - `registerQuickCartFlowActions.ts` (ação `quickcart_request_human`, antes linha 176-180 —
    chamava `sessionRepository.requestHuman` + `sendText` direto, agora delega aqui).
  - `GlobalHandler.tryHandle` (novo bloco, ver abaixo).

**Arquivos alterados:**
- `Messages.constant.ts`: `HUMAN_HANDOFF_PHRASES` (`atendente`, `humano`, `pessoa`,
  `falar com atendente`, `falar com alguém`, `falar com uma pessoa`, `quero um atendente`) e
  `MESSAGES.AGENT_ALREADY_WAITING`.
- `webhook/domain/Conversation.types.ts`: `ConversationSession.humanRequestedAt?: Date | null`
  (opcional para não obrigar os `buildSession` de teste já escritos a ganhar o campo).
- `webhook/domain/ConversationSessionRepository.interface.ts`: `requestHuman?(customerPhone)`
  (opcional pelo mesmo motivo — dublês de teste cobrem um método por vez).
- `webhook/infra/database/DrizzleConversationSessionRepository.ts`: mapeia `humanRequestedAt` no
  `toDomain` e implementa `requestHuman` delegando ao `SessionRepository` do
  `@adatechnology/meta-whatsapp-module` — não muda `mode` (spec §3.5: calar o bot está errado).
- `registerQuickCartFlowActions.ts`: novo dependency `conversationSessionRepository`; a ação
  `REQUEST_HUMAN` agora só chama `requestHumanHandoff`.
- `infra/container/index.ts`: passa `conversationSessionRepository` (já existente no escopo de
  `buildWebhookModule`) para `registerQuickCartFlowActions`.
- `GlobalHandler.ts`: novo bloco `isHumanHandoffRequest(message.body)` → `requestHumanHandoff`.

**Ordem de precedência no `GlobalHandler.tryHandle`** (documentada inline no código):
1. "sair"/"cancelar" (`isExitWord`) — sai da conversa.
2. **Pedido de atendente (`isHumanHandoffRequest`) — NOVO, logo em seguida.**
3. Botões de decisão de pedido (`order_continue:` / `order_cancel:` / troca de item).
4. Botão/list "repetir pedido".
5. Parser de lista de compras solta (`shouldHandleAsShoppingList`).

Atendente entra **antes** do parser de lista (item 5) de propósito — é o requisito explícito da
task: sem essa ordem, "atendente" sozinho em `awaiting_list`/`cart_review` cairia no parser de
lista (que casaria contra o catálogo, sem achar produto) em vez de chamar a fila de espera. Entra
**depois** de "sair" porque os dois são checagens de mensagem inteira independentes — nenhuma
mensagem real pode casar as duas —, e antes dos itens 3-4 porque estes só reagem a `button_reply`/
`list_reply`, nunca a texto puro, então a ordem relativa entre eles e o atendente não afeta nenhum
caso real.

**Não cala o bot** (spec §3.5): `requestHuman` do módulo só marca `humanRequestedAt = now()`,
sem tocar `mode` — a conversa segue em `mode: 'bot'`, respondendo normalmente até um atendente
assumir (`takeover`). Confirmado lendo `SessionRepository.requestHuman` em
`node_modules/@adatechnology/meta-whatsapp-module` (dist/index.js:444-449).

**Testes novos**, sem `as never` (dublês tipados via `Pick<Interface, 'metodo'>`/objeto literal
com os métodos usados, ou `as unknown as <Dependencies>` para os testes de handler que já seguiam
esse padrão no arquivo):
- `isHumanHandoffRequest.test.ts` (10 casos): positivos (`atendente`, `Quero falar com um
  atendente!`, `falar com alguém`, `ATENDENTE?`, `humano`, `preciso falar com uma pessoa`);
  negativos (`o atendente de ontem errou meu pedido`, `humanos erram`, `pessoa física`,
  `2 atendente`).
- `support/requestHumanHandoff.test.ts` (3 casos): marca a fila e avisa quando ninguém tinha
  pedido; não duplica quando `humanRequestedAt` já setado; não duplica quando `mode: 'human'` +
  `humanRequestedAt` setado (atendimento humano em curso).
- `GlobalHandler.test.ts` (7 casos): dispara em `AWAITING_LIST`, `CART_REVIEW`,
  `AWAITING_PAYMENT` e `CONFIRMING` (mesma ação — `requestHuman` + `AGENT_REQUESTED`); não
  duplica quando já aguardando; roda ANTES do `listHandler` em `AWAITING_LIST` (parser de lista
  não é chamado); mensagem que não é pedido de atendente não é engolida (`handled === false`,
  segue para o handler do estado).

**Números.** Baseline antes desta task: 381 testes passando, 0 falhas. Depois: **401 testes
passando, 0 falhas** (20 novos: 10 + 3 + 7 acima). `bun run typecheck` limpo (banco de teste
`quickcart-test-postgres`/`quickcart-test-redis` de pé, migrado). Frontend não tocado.

### T3.1 — correção: deduplicação e requestHuman obrigatório

**Dois defeitos confirmados no código da T3.1** (branch `feat/roteiro-atendimento`, commit `af13382`).

**Defeito 1 — a deduplicação por `humanRequestedAt` trava o atendimento para sempre.**
`requestHumanHandoff.ts` respondia `AGENT_ALREADY_WAITING` e não chamava `requestHuman` sempre que
`session.humanRequestedAt` estava preenchido. Mas no `@adatechnology/meta-whatsapp-module`
instalado (`dist/index.js`, `SessionRepository`), `humanRequestedAt` só é **escrito** por
`requestHuman` (`sql\`now()\``) e **nunca é limpo**: `setMode` (usado por `takeover` e `release`)
só grava `mode`/`assignedUserId`/`updatedAt`. Resultado: depois do primeiro pedido de atendente da
vida de um cliente — mesmo já resolvido e a conversa devolvida ao bot semanas antes —, todo pedido
futuro caía no ramo "já avisei" e nunca entrava na fila de novo.

**Correção**: a deduplicação passa a olhar `mode`, que é o campo que de fato muda no
takeover/release:
- `mode === 'human'` (atendente já assumiu): responde `MESSAGES.AGENT_HUMAN_IN_PROGRESS` ("Você já
  está falando com a nossa equipe — é só mandar sua mensagem por aqui.") e **não** chama
  `requestHuman`.
- Qualquer outro caso (`mode` bot ou qualquer outro valor): chama `requestHuman` **sempre**
  (renova `humanRequestedAt` e (re)põe na fila) e responde `MESSAGES.AGENT_REQUESTED`, como era
  antes da T3.1.
- `MESSAGES.AGENT_ALREADY_WAITING` removida (ficou sem uso).
- `mode` já chegava até `ConversationSession` — `DrizzleConversationSessionRepository.toDomain` já
  mapeava `mode: row.mode`; não foi preciso mapear nada de novo.

**Defeito 2 — `requestHuman` opcional na interface permitia prometer atendimento sem chamar ninguém.**
`ConversationSessionRepositoryInterface.requestHuman?` era opcional e a ação chamava
`requestHuman?.(...)` — se um dublê de teste (ou uma implementação futura) não trouxesse o método,
a chamada virava no-op silencioso e o cliente recebia `AGENT_REQUESTED` sem ninguém ter sido
avisado.

**Correção**: `requestHuman` passou a ser **obrigatório** na interface
(`ConversationSessionRepository.interface.ts`) e a ação chama sem `?.`. Todos os dublês de teste já
implementavam o método (o `bun run typecheck` não acusou nenhum dublê faltando) — nenhuma alteração
extra necessária nos testes por causa disso. `humanRequestedAt?` em `ConversationSession` segue
opcional e em uso: é preenchido pelo `DrizzleConversationSessionRepository.toDomain` e continua
sendo dado de domínio válido (não é mais usado para deduplicar nesta ação, mas não ficou sem
consumidor — permanece o retrato do estado persistido).

**Arquivos alterados:**
- `requestHumanHandoff.ts` — deduplicação por `mode`, `requestHuman` chamado sem `?.`.
- `Messages.constant.ts` — `AGENT_ALREADY_WAITING` → `AGENT_HUMAN_IN_PROGRESS` (texto e uso mudam).
- `ConversationSessionRepository.interface.ts` — `requestHuman?` → `requestHuman` (obrigatório).
- `requestHumanHandoff.test.ts` — troca o teste de "não duplica com `humanRequestedAt` setado" por
  "chama `requestHuman` de novo com `mode: 'bot'` e `humanRequestedAt` antigo" (o caso que a T3.1
  quebrou) e por "não chama com `mode: 'human'`".
- `GlobalHandler.test.ts` — mesma troca, no nível do handler global.

**Números.** Baseline antes desta correção: 401 testes passando, 0 falhas. Depois: **402 testes
passando, 0 falhas** (removidos 2 casos de deduplicação antiga, adicionados 3: dedup por `mode`
human, renovação de pedido com `mode` bot + `humanRequestedAt` antigo, no `GlobalHandler` e no
`requestHumanHandoff`). `bun run typecheck` limpo. Frontend não tocado.

**Achado para o usuário (não corrigido — é no pacote, não neste repo):** no
`@adatechnology/meta-whatsapp-module`, `release` (via `setMode`) não limpa `humanRequestedAt`. O
filtro `waitingHuman` da inbox (`Conversation.controller.ts`, query param `waitingHuman=true`) é
implementado pelo pacote com base em `humanRequestedAt is not null` — então uma conversa já
atendida e devolvida ao bot continua aparecendo na fila "aguardando atendimento" da inbox para
sempre, mesmo que `mode` já esteja de volta em `bot`. A correção correta é no pacote: `release`
deveria limpar `humanRequestedAt` (ou o filtro da inbox deveria considerar `mode` também, não só o
timestamp).

## T3.2 — Pedido em andamento no painel

**Passo 0 (⚠️ do architect): onde mora o carrinho em andamento?** Nos dois lugares, em fases diferentes.
Existem as tabelas `carts`/`cart_items` (`src/infra/database/schema/carts.ts`, `cart-items.ts`) e o
`DrizzleCartRepository`. O `cartDraft` de `conversation_sessions.context` é só o rascunho da lista/navegação
**antes** da revisão: `enterCartReview` → `materializeCartDraft` o converte em linhas de `cart_items` via
`AddCartItemUseCase`. Daí em diante `CartHandler` (`findOpenByCustomer`, l.240/285), `enterConfirming` (l.127) e
o checkout leem a **tabela**. Fonte verdadeira do card = carrinho aberto em `carts` do cliente do telefone,
canal WhatsApp; contexto da sessão só para as escolhas de checkout. O comentário do topo de
`ConversationContext.types.ts` ("Fase 4 não tem tabelas carts") está desatualizado — registrado, não alterado.

**API** (`apps/api-quickcart`)
- `GET /v1/admin/conversations/:number/checkout-context` → `ConversationCheckoutContext.controller.ts`
  (controller próprio; `requireSession` com `ADMIN_AND_ATTENDANT`, `userModule` injetável só para teste).
- `GetConversationCheckoutContext.use-case.ts` + `types/GetConversationCheckoutContext.types.ts` +
  `shared/CheckoutContext.schema.ts` (Zod `.strict()` — a resposta não carrega chave além do recorte).
- Resolve sessão por `conversationSessionRepository.findByPhone` (que já encapsula o tenant) — nenhum uso novo
  de `COMPANY_ID`. Cliente por `customerRepository.findByPhone`, carrinho por `findOpenByCustomer`, produtos
  num único `findByIds` (sem N+1). Linha = `round(preço × qtd)`, igual ao resumo do WhatsApp.
- `amountDueInCents` calculado no backend com `amountDueInCents()` e a taxa **do contexto**
  (`checkoutDeliveryFeeInCents`, ausente = 0). Endereço por `formatAddressLine`.
- Sem carrinho com itens e sem escolha de checkout → `200 { data: null }`. Nada é logado.
- Ligação: `ConversationRoutes.ts`, `server.ts`, `container/index.ts`.
- Testes: use case (null sem pedido; itens/subtotal/taxa/total/endereço/troco; não vaza nome, e-mail, CEP; só
  as 8 chaves) e controller (admin/atendente 200, separador/motorista 403, sem sessão 401, data null).

**Front** (`apps/frontend-web`)
- `components/OrderInProgressCard.tsx` no slot `renderAboveTranscript` de `AdminConversations.page.tsx`
  (o slot recebe `conversation`; `conversation.id` é o telefone — o pacote não precisou mudar).
- `hooks/useConversationCheckoutContext.query.ts` (react-query, refetch 15s), `adminGetConversationCheckoutContext`
  em `shared/api/client.ts`, tipo em `api.types.ts`, textos/chaves em `shared/orderInProgress.constant.ts`.
- `toContextEntries` esconde `cartDraft`, `unmatchedTerms`, `pendingResolutions`, `awaitingQuantityProduct`,
  `editingCartItemId` e as `checkout*` que o card mostra (fim do JSON cru na coluna lateral).
- Testes: `conversationContext.test.ts` e `OrderInProgressCard.test.tsx` (renderToStaticMarkup com
  QueryClient pré-populado: vazio com `null`; exibe o total do backend mesmo diferente de subtotal+taxa; "grátis").

**Números:** api 402 → 412 (0 falhas, typecheck limpo) · frontend 12 → 17 (0 falhas, typecheck limpo).
Pendente, fora do escopo: autorização por objeto continua só por papel (igual às rotas vizinhas, tenant único).

## T4.1 — Auditoria

Auditoria do `code-standart.md` §15 sobre `git diff origin/main...HEAD` (117 arquivos,
+6528/-127) e do `security.md` §1 (PII em log).

### 1. N+1 e I/O

- **Confirmado**: `buildPricedOrderItems` (`order/shared/buildPricedOrderItems.ts`) já faz
  `findByIds` uma vez para todos os itens (corrigido na T2.2, revisão de N+1) — nenhum `await`
  por item nos arquivos alterados. `for` sem I/O dentro (só somas/validações síncronas) em
  `CreateOrderFromCart.use-case.ts:38`, `DrizzleOrderRepository.ts:179,664`,
  `SimpleReceiptProvider.ts:76,85`, `isHumanHandoffRequest.ts:37`, `OrderSeedRunner.ts:99`
  (script de seed, sequencial de propósito, fora de rota HTTP).
- **Previsão de entrega (T1.3)**: confirmado que `ResolveOrderDeliveryEstimateUseCase` geocodifica
  até 2 CEPs por confirmação (loja + cliente) e que `ResolveCepCoordinateUseCase` cacheia o
  resultado em Postgres via `DrizzleGeocodedAddressRepository` — o CEP da loja paga
  geocodificação só na primeira confirmação do processo; o do cliente, só na primeira vez que
  aparece. Nenhuma mudança necessária: o cache existente cobre o volume de uma confirmação
  (já registrado na T1.3, consolidado aqui).
- **`GET /v1/admin/conversations/:number/checkout-context`** (`GetConversationCheckoutContext.use-case.ts`):
  confirmado UMA ida ao banco por tabela — `conversationSessionRepository.findByPhone` (sessão),
  `customerRepository.findByPhone` (cliente), `cartRepository.findOpenByCustomer` +
  `listItems` (carrinho, 2 chamadas fixas, não por item), `productRepository.findByIds`
  (produtos em lote, uma chamada para todos os itens do carrinho). O `.map` sobre os itens do
  carrinho é síncrono (usa o `Map` já montado), sem I/O por item. A rota é chamada a cada 15s
  por conversa aberta (`ORDER_IN_PROGRESS_REFETCH_INTERVAL_MS`) — cada chamada continua sendo
  4 idas ao banco, independente do tamanho do carrinho.

### 2. Logs sem PII

- Varredura de `git diff` por `log.`/`logger.` em linhas adicionadas: **nenhum log novo** no
  diff inteiro (único `logger`/`log.*` que toca dado de checkout é
  `checkoutLog.warn('delivery_estimate_unavailable', { orderId, error })`, da T1.3, que já loga
  só `orderId` — nunca telefone/endereço/CEP/valor do troco).
  Confirmado que troco (`checkoutCashChangeForInCents`) e endereço (`checkoutAddress`) não
  aparecem em nenhum `logger.*`/`console.*` novo.

### 3. Sanitização/validação nas rotas novas

- **`POST /v1/store/checkout-quote`**: `validateBody(checkoutQuoteBodySchema, ...)` (Zod,
  `items` 1..100 com `productId` uuid e `quantity` positiva, `deliveryType` enum) antes de
  qualquer lógica; erros de domínio (`ProductNotFoundError` 404, `CartProductUnavailableError`
  409) e de schema (`ValidationError` 400) — nenhum `try/catch` no controller, propagam para o
  exception filter global, que não vaza stack trace ao cliente.
- **`GET /v1/admin/conversations/:number/checkout-context`**: `requireSession` com
  `ADMIN_AND_ATTENDANT` antes de tudo; parâmetro de rota validado (`ValidationError` se
  ausente); resposta passa por `CHECKOUT_CONTEXT_RESPONSE_SCHEMA.parse` (Zod `.strict()`) —
  garante que só as chaves do recorte saem, nunca o contexto bruto da sessão. Nenhum
  `try/catch` local; erro desconhecido cai no filtro global (500 genérico, sem stack trace).

### 4. Strings repetidas (§16)

- Varredura de literais repetidos 2+ vezes nas linhas adicionadas do diff: os casos com
  repetição real são fixtures de teste (`'Arroz 5kg'`, `'Maria'`, `'Rua X'`, `'Cliente Teste'`,
  `'Bairro'`) — dado de teste, não regra de domínio, fora do escopo do §16. Valores de domínio
  repetidos (`'delivery'`, `'pickup'`, `'cash'`, `'button_reply'`, `'atendente'`/`'humano'`/
  `'pessoa'`) já vêm de constantes centralizadas (`DELIVERY_TYPE`, `PAYMENT_METHOD`,
  `HUMAN_HANDOFF_PHRASES` em `Messages.constant.ts`) — nenhuma string de domínio nova precisou
  de extração.

### 5. Set/Map vs array em buscas

- Confirmado uso de `Map`/`Set` nos pontos de busca por id introduzidos nesta spec:
  `buildPricedOrderItems` (`new Map` por `product.id`), `GetConversationCheckoutContext.use-case.ts`
  (`new Map` por `product.id`), `toContextEntries` (`new Set` para `knownKeys`). Nenhuma busca
  por id em array (`.find`) dentro de laço nos arquivos alterados.

### Correções aplicadas nesta task

- `apps/api-quickcart/src/modules/conversation/shared/ConversationContext.types.ts` — comentário
  do topo corrigido: dizia que a Fase 4 "não tem tabelas `carts`/`cart_items`" (desatualizado
  desde a T3.2, que confirmou que as tabelas existem e que `cartDraft` é só o rascunho antes da
  revisão).
- `apps/frontend-web/src/modules/conversations/shared/conversationContext.ts` — `toContextEntries`
  mostrava linhas sempre vazias para `deliveryType`/`address`/`paymentMethod`: o motor grava
  essas escolhas com prefixo `checkout*` (`checkoutDeliveryType` etc.), então as chaves sem
  prefixo nunca são preenchidas. Removidas do mapa de rótulos fixos (`CONTEXT_LABELS`); o bloco
  "Pedido em andamento" (T3.2) já mostra o mesmo dado com o prefixo correto. Teste novo em
  `conversationContext.test.ts` confirma que as três chaves não aparecem mais na saída.
- `init-claude.md` (raiz) — nova seção "Roteiro de atendimento" com os estados novos
  (`AWAITING_CASH_CHANGE`, `AWAITING_CASH_CHANGE_AMOUNT`), colunas novas
  (`cash_change_for_in_cents`, `delivery_fee_in_cents`), a env `DELIVERY_FEE_CENTS` e a regra de
  taxa fora do total fiscal, as rotas novas, e `requiresCardMachine`/`amountDueInCents` como
  fontes únicas.

### Suíte

- `docker start quickcart-test-postgres quickcart-test-redis` — de pé.
- `bun run typecheck` limpo em `api-quickcart`, `worker-quickcart` e `frontend-web`.
- `bun run test`: api-quickcart **412 passando, 0 falhas**; worker-quickcart **19 passando,
  0 falhas**; frontend-web **18 passando, 0 falhas** (17 da baseline + 1 teste novo do item
  corrigido no `toContextEntries`).

## Achados para o usuário (fora do escopo)

- `NominatimGeocodingProvider.ts:107` loga o CEP em claro (evento `geocode_failed`, campo
  `cep: digitsOnly`) — código anterior a esta branch, não tocado por nenhuma task da spec.
- `CreateWebOrder.use-case.ts` enfileira a emissão do recibo/nota na criação do pedido: se um
  item ficar em falta ou for substituído depois, a nota já emitida fica com o total antigo.
- `@adatechnology/meta-whatsapp-module`: `release` (via `setMode`) não limpa `humanRequestedAt`
  — a conversa já atendida e devolvida ao bot continua aparecendo para sempre na fila
  "aguardando atendimento" da inbox, porque o filtro `waitingHuman` do pacote olha só o
  timestamp, não `mode` (já anotado na T3.1; consolidado aqui).
- Autorização das rotas da inbox (e da rota nova `checkout-context`) é só por papel
  (`ADMIN_AND_ATTENDANT`), não por conversa atribuída — mesma limitação já registrada na T3.2.
- Taxa de entrega > 0 exige resposta do contador sobre como documentar no fiscal antes de ligar
  em produção — a NFC-e registra só os itens (`modFrete = 9`), nunca a taxa.
- Não existe tela de motorista separada; quem entrega vê o selo "Levar maquininha" e o troco
  pelas mesmas telas do painel (`OrderDetailView`/`OrdersTableView`), sob controle de papel.
- A lista do painel (`OrdersTableView`) ordena pelo total dos itens (`totalInCents`), mas exibe
  o valor cobrado (`amountDueInCents`) — decisão aceita na T2.1: com taxa fixa por pedido, a
  ordem só diverge entre entrega e retirada de valores próximos.

## T4.2 — Correções da revisão final

### Segurança

- **S1** — `POST /v1/store/checkout-quote`: teto de corpo de 64 KB só nesta rota (opção
  `maxBodyBytes` no `Router.post`; `Content-Length` acima → 413 `PAYLOAD_TOO_LARGE` antes de ler;
  chunked lido contando bytes e abortado no teto). Não global: `/v1/admin/conversations/:number/media`
  e `/v1/preview/media` recebem arquivo pelo mesmo leitor. Rate limit por IP 60/min em janela fixa
  no Redis (`src/infra/http/rate-limit/`: `FixedWindowRateLimiter.protect`, `RedisRateLimitStore`,
  `resolveClientIp`, constantes em `rateLimit.constant.ts` e `Store.constant.ts`), 429 com
  `Retry-After`. IP = último salto do `X-Forwarded-For` (o que o edge acrescenta; o início é
  forjável) → `X-Real-IP` → `unknown`. Fail-open com `warn` sem IP. Registrado em
  `docs/SECURITY.md` com M2 e B5. Testes: `src/infra/http/bodyLimit.test.ts` (413 por
  Content-Length, 413 chunked, corpo pequeno chunked parseado, rota sem opção aceita corpo grande)
  e `src/infra/http/rate-limit/FixedWindowRateLimiter.test.ts` (429 + Retry-After, contagem por IP,
  XFF forjado no início não escapa, Redis fora → 200, `resolveClientIp`).
- **S2** — inativo responde igual a inexistente (404 `PRODUCT_NOT_FOUND`) na borda
  (`StoreController.priceQuoteItems`); `buildPricedOrderItems` segue distinguindo porque o
  `CreateWebOrder` (cliente logado) precisa do motivo. Teste: `Store.controller.test.ts` "produto
  inativo responde igual ao inexistente".
- **S3** — conferido: `formatAddressLine` não usa o CEP no formato estruturado (só rua, número,
  complemento, bairro, cidade/UF); nenhuma mudança necessária. Endereço em texto livre legado
  passa como o cliente digitou. Teste que fixa o comportamento:
  `GetConversationCheckoutContext.use-case.test.ts` "card do painel não leva o CEP no endereço".

### Qualidade

- **Q1** — `confirmOrder` revalida o troco contra itens atuais + taxa (`amountDueInCents`) antes de
  criar o pedido; troco <= total → volta a `AWAITING_CASH_CHANGE_AMOUNT` com
  `CHECKOUT_CASH_CHANGE_TOTAL_CHANGED`. Teste: `CheckoutHandler.confirmCashChange.test.ts` (troco 50,
  total 52 → sem pedido, estado e mensagem; total 48 → cria).
- **Q2** — `resolveCheckoutDeliveryFeeInCents({ context, configuredFeeInCents })` em
  `conversation/shared/`, usado em `CheckoutHandler.confirmOrder`, `enterConfirming`,
  `CashChangeHandler` e `GetConversationCheckoutContext` (os dois últimos ganharam a dependência
  `configuredDeliveryFeeInCents`). Testes: `resolveCheckoutDeliveryFeeInCents.test.ts` (sem chave +
  entrega + 800 → 800) e um caso "sessão anterior ao deploy" em cada um dos quatro pontos.
- **Q3** — `GlobalHandler.handleRepeatOrder` grava `carryRememberedCheckout(sessionContext)`. Teste:
  `GlobalHandler.test.ts` "repetir pedido preserva a memória do Alterar".
- **Q4** — valor exato do total grava `null` e segue. O teste antigo "recusa valor igual ao total"
  foi trocado por "valor EXATO ... vale como não preciso de troco" (a regra mudou por decisão da
  revisão); o de "não cobre" passou a usar 90.
- **Q5** — em `AWAITING_CASH_CHANGE`, texto com valor vai para a mesma validação do
  `AWAITING_CASH_CHANGE_AMOUNT`. `parseCashAmountToCents` passou a aceitar um único número dentro de
  uma frase ("troco pra 100", "vou pagar com 50"); dois números ou sinal de menos seguem recusados.
  Testes: `CashChangeHandler.test.ts` (aceita "troco pra 150", recusa "troco pra 80") e novos casos
  em `parseCashAmountToCents.test.ts`.
- **Q6** — `OrdersPreview.page.tsx` e `OrderDetailPreview.page.tsx` usam `deliveryFeeInCents` e
  `amountDueInCents` fixos na fixture. Efeito colateral aceito: no preview de detalhe, marcar item em
  falta não recalcula mais o total (no produto quem recalcula é o servidor).

### Testes que faltavam

- **A1** — `CheckoutHandler.confirmCashChange.test.ts` "troco 150 no contexto chega ao pedido e
  aparece na mensagem de confirmação" (`cashChangeForInCents === 15000` e linha
  `ORDER_CONFIRMED_CASH_CHANGE_LINE`).
- **A2** — trecho de troco/selo extraído do `OrderDetailView` para `OrderPaymentNotes.tsx`;
  `OrderPaymentNotes.test.tsx` (renderToStaticMarkup): selo presente/ausente conforme
  `requiresCardMachine`, "Troco para R$ 150,00" presente com valor e ausente com `null`.

### Suíte

- `docker start quickcart-test-postgres quickcart-test-redis` — de pé.
- `bun run typecheck` limpo em `api-quickcart`, `worker-quickcart` e `frontend-web`.
- `bun run test`: api-quickcart **443 passando, 0 falhas** (412 + 31); worker-quickcart **19
  passando, 0 falhas**; frontend-web **22 passando, 0 falhas** (18 + 4).
