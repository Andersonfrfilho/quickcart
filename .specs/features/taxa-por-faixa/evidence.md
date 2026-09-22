# Evidência — Taxa por faixa

## T1.1 — QuoteDeliveryFee

**Arquivos** (em `apps/api-quickcart/`):
- `src/modules/order/application/use-cases/QuoteDeliveryFee.use-case.ts` — use case.
- `src/modules/order/application/types/QuoteDeliveryFee.types.ts` — `QuoteDeliveryFeeParams` / `QuoteDeliveryFeeResult` (união da spec §3.3).
- `src/modules/order/domain/DeliveryFeeTierRepository.interface.ts` — `DeliveryFeeTier` + `listOrdered()` (só interface; tabela na T1.2).
- `src/modules/order/shared/DeliveryFeeQuote.constant.ts` — kinds, reasons, sources.
- `src/modules/shared/address/deliveryEstimate.ts` — `calculateRoadDistanceKm` (haversine × desvio) extraída; `estimateDelivery` passa a usá-la, logo `ResolveOrderDeliveryEstimate` usa a mesma função sem mudar comportamento.
- `tests/QuoteDeliveryFee.test.ts` — 12 casos.

**Decisões:**
- Precisão de cidade: `GEOCODE_PRECISION.CITY` (`'city'`) em `Address.schema.ts`, devolvida por `ResolveCepCoordinate` (cache ou Nominatim). Tratei `city` **e** `none` como aproximadas — o mesmo conjunto que `deliveryEstimate.ts` já usa para não prometer horário.
- Só a precisão do **cliente** decide `approximate_max_tier`. Loja com CEP genérico não força a maior faixa (a coordenada do WhatsApp continua exata); a spec não cobre esse caso.
- Resolvedor de CEP injetado como `Pick<ResolveCepCoordinateUseCase, 'execute'>` — dublê tipado sem `as never`.
- Ordem das verificações: retirada → faixas → CEP da loja → localização → geocodificação. Nenhum log (sem coordenada).
- Ainda não ligado no container: nenhum consumidor nesta task.

**Números:** typecheck limpo. `bun run test`: antes 560 pass / 0 fail (85 arquivos); depois 572 pass / 0 fail (86 arquivos). `tests/ResolveOrderDeliveryEstimate.test.ts` verde sem alteração.

## T1.2 — Tabela, repositório e validação

**Arquivos** (em `apps/api-quickcart/`):
- `src/infra/database/schema/delivery-fee-tiers.ts` — tabela `delivery_fee_tiers` (uuid PK, `max_distance_km numeric(5,2)`, `fee_in_cents integer`, CHECKs, UNIQUE); exportada em `schema/index.ts`.
- `drizzle/migrations/0022_delivery_fee_tiers.sql` + entrada `idx: 22` em `drizzle/migrations/meta/_journal.json` com `when: 1790082265085` (epoch ms real, gerado com `python3 -c "import time; print(int(time.time()*1000))"`, maior que o `1790036900738` da 0021). Conferido com script Python: idx contíguo, `when` crescente, todos os arquivos de tag existem.
- `src/modules/order/domain/DeliveryFeeTierRepository.interface.ts` — acrescentei `replaceAll(tiers)` à interface criada na T1.1.
- `src/modules/order/infra/database/DrizzleDeliveryFeeTierRepository.ts` — `listOrdered` (ordena por `maxDistanceKm` asc, converte `numeric` string→number) e `replaceAll` (delete + insert em `db.transaction`).
- `src/modules/order/shared/DeliveryFeeTiers.schema.ts` — `deliveryFeeTiersInputSchema` (Zod): 1–10 faixas, `maxDistanceKm` 0,1–50 com até 2 casas, `feeInCents` inteiro 0–100000, `superRefine` acumulando violação de crescimento estrito faixa a faixa (não para na primeira).
- `tests/DeliveryFeeTiers.schema.test.ts` — 10 casos, incluindo "reporta todos os erros de uma vez".
- `src/modules/order/infra/database/DrizzleDeliveryFeeTierRepository.integration.test.ts` — 6 casos contra o Postgres de teste: `listOrdered` ordena, `replaceAll` substitui (inclusive para lista vazia), CHECK recusa `fee_in_cents < 0` e `max_distance_km <= 0`, UNIQUE recusa teto duplicado.
- `tests/QuoteDeliveryFee.test.ts` — `FakeTierRepository` da T1.1 ganhou `replaceAll` (lança, não usado nesses testes) para continuar implementando a interface sem `as never`.

**Decisões:**
- `db.insert(...).values(...)` do Drizzle é *thenable* mas não é reconhecido como `Promise` por `expect(...).rejects` do bun:test (falha com "Expected promise, received: PgInsertBase"); resolvido envolvendo a chamada numa IIFE `async`, que adota o thenable como Promise nativa antes do `expect`.
- CHECK e UNIQUE ficam tanto no schema Drizzle (`check()`, `uniqueIndex()`) quanto na migration SQL manual, escritos à mão para casar exatamente — sem depender de `drizzle-kit generate` neste ambiente.
- `replaceAll([])` esvazia a tabela (fail-closed da spec §3.1: sem faixa configurada, não há entrega) — testado explicitamente.

**Números:** migration aplicada no banco de teste (`\d delivery_fee_tiers` confere CHECKs e UNIQUE). Typecheck limpo. `bun run test`: 588 pass / 0 fail (88 arquivos) — base 572 + 16 testes novos (10 validação + 6 integração).
