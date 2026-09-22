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
