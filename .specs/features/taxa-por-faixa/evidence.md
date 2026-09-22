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
