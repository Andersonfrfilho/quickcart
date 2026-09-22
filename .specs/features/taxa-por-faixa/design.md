# Design — Taxa por faixa (architect, opus, 2026-09-22)

Registro do desenho validado, com as mudanças trazidas pelas decisões do usuário (spec §2).
Caminhos relativos a `apps/api-quickcart/src` quando não indicado.

## Estado atual (medido em `4162dc8`)

- **Não existe configuração da loja no QuickCart.** `ConversationSettings.controller.ts` repassa as
  configurações do pacote `meta-whatsapp`; `/admin/customer-settings` e `/admin/notifications/settings`
  são telas de pacotes. Por isso: **tabela nova**.
- Taxa fixa: `order/shared/amountDue.ts:27` (`resolveDeliveryFeeInCents`), `:33` (a única soma).
  `environment.ts:186` (`DELIVERY_FEE_CENTS`) → `container/index.ts:246,500,507,900`, `server.ts:153`.
- **WhatsApp cota no clique:** `CheckoutHandler.ts:145` ("Isso mesmo"), `:201` (entrega), `:215`
  (retirada) chamam `quoteDeliveryFeeInCents(buttonId)` — **antes** do endereço. O endereço vem em
  `:224-259` (CEP de 8 dígitos → ViaCEP → `AWAITING_ADDRESS_NUMBER`; CEP que não resolve ou texto
  livre → `checkoutAddress` em texto, sem CEP) e `:262+` (endereço estruturado).
- Sessões antigas: `resolveCheckoutDeliveryFeeInCents.ts:25` (contexto, senão env).
- Resumo e troco leem a taxa em `enterConfirming.ts:81-86`.
- Distância: `ResolveOrderDeliveryEstimate` recebe `OrderRecord` (pedido já criado); `isOutsideRadius`
  é **aviso**, não trava. `ResolveCepCoordinate` usa cache e só chama o Nominatim quando não acha —
  **sem cache negativo**. `geocoded_addresses` tem PK no `cep` e guarda `precision`.
- Web: `useCheckoutPage.hook.ts:47,74-108` já coleta o CEP (ViaCEP), mas a cotação não o recebe
  (`api.types.ts:165-168`; chave `['checkout-quote', deliveryType, items]` em
  `useCheckoutQuote.query.ts:20`). Rota pública com limite por IP (`StoreRoutes.ts:27-31`).
- Criação: `CreateWebOrder.use-case.ts:110`, `CreateOrderFromCart.use-case.ts:63`. `orders.ts:38`
  guarda só `delivery_fee_in_cents`.
- Não existe rota de edição de endereço de pedido (`OrderRoutes.ts:29-39`).

## Modelo de dados

**`delivery_fee_tiers`** (migration aditiva): `id` uuid PK · `max_distance_km numeric(5,2) NOT NULL
CHECK > 0` · `fee_in_cents integer NOT NULL CHECK >= 0` · `created_at`/`updated_at` ·
`UNIQUE(max_distance_km)`. Tabela e não jsonb: não há onde pendurar um jsonb, e a tabela dá CHECK e
ordenação por SQL.

**Seed de boot** (`EnsureDefaultDeliveryFeeTiers`, idempotente, porque SQL não lê env): tabela vazia →
**3 km / 500 e 8 km / 1000** (decisão D4 — substitui a sugestão do architect de "8 km / 0").

**Cache negativo** `geocode_failures` (`cep` PK, `failed_at`), TTL 24 h, consultado antes do provedor.

**Pedido** (migration aditiva, nullable): `delivery_distance_km numeric(6,2)`,
`delivery_tier_max_km numeric(5,2)`, `delivery_tier_fee_in_cents integer`,
`delivery_location_source varchar(20)` (`whatsapp_location` | `cep` | `cep_approximate`). Snapshot, sem
FK. Espelhar no schema do worker.

## Use case `QuoteDeliveryFee`

Em `order/application/use-cases/`. Entrada `{ deliveryType, location }`, onde `location` é
`{ kind: 'coordinates', latitude, longitude }` (localização do WhatsApp) **ou** `{ kind: 'cep', cep }`.
Saída — união discriminada:

```ts
| { kind: 'pickup', feeInCents: 0 }
| { kind: 'quoted', feeInCents, distanceKm, tier: { maxDistanceKm, feeInCents }, source }
| { kind: 'approximate_max_tier', feeInCents, tier, source: 'cep_approximate' }   // D3
| { kind: 'out_of_range', distanceKm, maxDistanceKm }
| { kind: 'unavailable', reason: 'no_store_cep' | 'no_customer_location' | 'geocoding_failed' | 'no_tiers' }
```

- Reusa `ResolveCepCoordinate` e a função de distância (haversine × fator de desvio de rua), extraída
  para `modules/shared/address/deliveryEstimate.ts` e usada também por `ResolveOrderDeliveryEstimate` —
  tela e taxa nunca divergem.
- **D3 (mudança sobre o architect):** precisão "cidade" deixa de ser `unavailable` e vira
  `approximate_max_tier`. Não calcula a distância (ela seria da cidade, não da casa).
- Coordenada da loja em memória (sempre o mesmo CEP). Semáforo global de 1 chamada/s ao provedor.

## Fluxo no WhatsApp

- `:201` (entrega) deixa de cotar; `:215` (retirada) grava taxa 0 direto.
- **Endereço por CEP:** `handleAwaitingAddressNumber` cota antes de `AWAITING_PAYMENT`.
- **Endereço por localização (D2):** em `AWAITING_ADDRESS`, mensagem `location` → cota pela coordenada
  → pede número/complemento/referência para o entregador → `AWAITING_PAYMENT`. O endereço guarda
  latitude/longitude (o `addressSchema` já tem os campos, da spec `delivery-distance`).
- **Texto livre sem CEP:** não serve para entrega — o bot pede CEP ou localização (mensagem nova), com
  "Retirar na loja" como alternativa.
- `quoted`/`approximate_max_tier` → grava `checkoutDeliveryFeeInCents`, distância, faixa e fonte no
  contexto; manda "Taxa de entrega para seu endereço (X km): R$ Y" (ou "(estimativa pela cidade)").
- `out_of_range`/`unavailable` → `AWAITING_OUT_OF_RANGE_DECISION` com Retirar / Outro endereço.
- "Isso mesmo": retirada → 0; entrega → **recota** com a localização lembrada; falhou → caminho longo.
- "Alterar": `withoutDeliveryQuote(context)` apaga taxa, distância, faixa e fonte.
- Sessão antiga: `enterConfirming` cota na hora pela localização do contexto; se não conseguir, volta ao
  endereço. `resolveCheckoutDeliveryFeeInCents` perde o fallback de env.
- `CreateOrderFromCart` recebe a cotação **do contexto** e não recalcula.

## Web

- `checkoutQuoteBodySchema` ganha `cep?` (8 dígitos), obrigatório com entrega. Resposta:
  `deliveryQuote: { kind, distanceKm?, maxDistanceKm?, tier? }` e `isDeliveryAvailable`.
- Query habilitada só com CEP completo; chave `['checkout-quote', deliveryType, cep, items]`. Sem CEP:
  "Informe o CEP para calcular a taxa".
- `CreateWebOrder` recota: mudou → 409 `DELIVERY_FEE_CHANGED`; fora → 422 `DELIVERY_OUT_OF_RANGE`.
- A rota devolve distância arredondada a 0,1 km e a faixa — **nunca a coordenada**.

## Painel

- `GET`/`PUT /v1/admin/delivery-fee-tiers`, `requireSession({ roles: ADMIN_ONLY })` nos dois.
  `ReplaceDeliveryFeeTiers` (delete + insert numa transação). Log `info` de auditoria.
- `AdminDeliveryFees.page.tsx` + hook, rota em `app/routes.tsx`, menu em `components/Layout.tsx`.
- `OrderDetailView.tsx:493` e `OrderInProgressCard.tsx:52`: "Faixa até N km · X km" (lido do pedido /
  do contexto, nunca da configuração atual).

## Trade-offs aceitos

| Decisão | Custo |
|---|---|
| PUT da lista inteira | sem edição por linha nem histórico de versões (snapshot no pedido + log) |
| Sem CEP e sem localização, não entrega | um passo a mais para quem digitou endereço solto |
| Falha de geocodificação bloqueia | perde a venda de entrega quando o provedor cai (retirada continua) |
| Web recota na criação | uma recotação extra se o admin editar no meio de uma compra |
| Cidade aproximada cobra a maior faixa (D3) | pode cobrar a mais de quem mora perto num CEP genérico |
