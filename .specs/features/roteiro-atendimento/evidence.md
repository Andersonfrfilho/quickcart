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
