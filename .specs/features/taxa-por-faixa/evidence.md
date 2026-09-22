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

## T1.3 — Seed de boot

**Arquivos** (em `apps/api-quickcart/`):
- `src/modules/order/shared/DefaultDeliveryFeeTiers.constant.ts` — `DEFAULT_DELIVERY_FEE_TIERS` (3 km/500, 8 km/1000, D4).
- `src/modules/order/application/use-cases/EnsureDefaultDeliveryFeeTiers.use-case.ts` — `EnsureDefaultDeliveryFeeTiersUseCase`: `listOrdered()` vazio → `replaceAll(DEFAULT_DELIVERY_FEE_TIERS)`; qualquer faixa existente → não mexe.
- `src/infra/container/index.ts` — instancia `DrizzleDeliveryFeeTierRepository` e exporta `seedDefaultDeliveryFeeTiers()`, no mesmo padrão de `seedMainFlow`/`seedOrderStatusTemplates`.
- `src/index.ts` — chama `seedDefaultDeliveryFeeTiers()` no boot, depois de `runMigrations()` e das outras seeds, antes do Redis.
- `tests/EnsureDefaultDeliveryFeeTiers.test.ts` — 3 casos com `FakeTierRepository`: vazia cria as duas faixas; existente não sobrescreve; rodar 2x não duplica (`replaceAll` chamado só 1 vez).

**Decisões:**
- Seguido o padrão de função exportada solta (não classe de módulo) porque é assim que `seedMainFlow`/`seedOrderStatusTemplates` já funcionam no `container/index.ts` — o use case em si é uma classe testável isoladamente, e a função do container só monta a instância com o repositório real.
- Sem teste de integração dedicado para T1.3: o use case já é coberto por unit test com fake, e a tabela real já tem cobertura de `replaceAll`/`listOrdered` na T1.2 — um terceiro teste batendo no Postgres só para repetir a mesma lógica seria redundante.

**Números:** typecheck limpo. `bun run test`: 591 pass / 0 fail (89 arquivos) — base 588 + 3 testes novos.

## T1.4 — Cache negativo e ritmo do provedor

**Arquivos** (em `apps/api-quickcart/`):
- `src/infra/database/schema/geocode-failures.ts` — tabela `geocode_failures` (`cep` PK, `failed_at`); `drizzle/migrations/0023_geocode_failures.sql` + journal `idx 23`, `when: 1790082918150` (maior que o da 0022; conferido pelo mesmo script Python da T1.2).
- `src/modules/shared/address/GeocodeFailureRepository.interface.ts` + `src/modules/shared/address/infra/DrizzleGeocodeFailureRepository.ts` — `findByCep`/`save` (upsert)/`remove`.
- `src/modules/shared/address/ResolveCepCoordinate.use-case.ts` — reescrito: memória do processo (`Map` de instância, checada antes do cache em banco — cobre "coordenada da loja em memória" do design.md, e vale para qualquer CEP); `geocodeFailureRepository` e `now` agora são dependências **opcionais** (retrocompatível com quem já instanciava sem elas); antes do provedor, consulta a falha e recusa se `now - failedAt < 24h` (`GEOCODE_FAILURE_TTL_MS`, exportada); falha nova grava, sucesso remove.
- `src/infra/nominatim/NominatimGeocodingProvider.ts` — `now`/`sleep` viraram dependências injetáveis (default `Date.now`/`Bun.sleep`); o semáforo de 1 req/s já existia por instância (`lastCallAt`), e a instância já é única por processo em `container/index.ts` — só faltava dar para testar sem esperar 1,1s de verdade.
- `src/infra/container/index.ts` — injeta `DrizzleGeocodeFailureRepository` no `resolveCepCoordinateUseCase` existente.
- `tests/ResolveCepCoordinate.test.ts` — 4 casos novos: falha < 24h não chama o provedor; falha > 24h chama de novo; falha nova é gravada; sucesso remove a falha registrada.
- `tests/NominatimGeocodingProvider.rateLimit.test.ts` — 2 casos com `now`/`sleep` injetados: duas chamadas concorrentes serializam (a segunda espera); chamada muito depois da anterior não espera.

**Decisões:**
- Sem semáforo adicional em `ResolveCepCoordinate`: o rate limit já vivia no `NominatimGeocodingProvider` (`lastCallAt` de instância) e a instância já nasce única no container — bastou torná-lo testável, não duplicar a trava num segundo lugar (a spec permite "no GeocodingProvider **ou** no ResolveCepCoordinate").
- `hasRecentFailure`/`recordFailure`/`clearFailure` degradam sem lançar quando `geocodeFailureRepository` está ausente ou falha ao gravar/remover — mesma disciplina de "nunca lança" do resto da classe (o cache negativo é uma otimização, não pode derrubar a cotação).
- Armadilha no teste de ritmo: o relógio de teste precisou começar em `1000`, não `0` — `lastCallAt === 0` é o sinal interno de "nunca chamou", e um relógio começando em zero faria a SEGUNDA chamada also parecer a primeira.
- `maskCep` já cobria os logs existentes; os `warn` novos (`failure_not_cached`, `failure_not_cleared`) seguem o mesmo padrão — nenhum CEP em texto claro em log.

**Números:** migration aplicada no banco de teste (`\d geocode_failures` confere PK). Typecheck limpo. `bun run test`: 597 pass / 0 fail (90 arquivos) — base 591 + 6 testes novos (4 cache negativo + 2 ritmo; `QuoteDeliveryFee` e `ResolveOrderDeliveryEstimate` seguem verdes sem alteração de comportamento).

## T1.5 — Erros

**Arquivos** (em `apps/api-quickcart/`):
- `src/shared/errors/codes.ts` — `DELIVERY_OUT_OF_RANGE`, `DELIVERY_FEE_CHANGED`, `DELIVERY_UNAVAILABLE`.
- `src/shared/errors/OrderErrors.ts` — `DeliveryOutOfRangeError` (422, `{ distanceKm, maxDistanceKm }`), `DeliveryFeeChangedError` (409, `{ previousFeeInCents, currentFeeInCents }`), `DeliveryUnavailableError` (422, `{ reason }`), todas estendendo `OrderError`/`DomainError`/`AppError` no mesmo padrão das existentes.
- `tests/DeliveryFeeErrors.test.ts` — 3 casos.

**Decisões:**
- O router (`src/infra/http/router.ts`) já responde qualquer `AppError` genericamente por `instanceof` lendo `statusCode`/`code` (linha ~272) — não existe, e não precisa existir, um mapeamento por classe. Não há nenhum teste de nível HTTP para as classes de erro já existentes (`OrderNotFoundError` etc.) neste repositório; o teste que prova "o filtro responde o status e o código certos" verifica exatamente o que o filtro lê — `instanceof AppError`, `statusCode`, `code` — no mesmo nível das demais suítes de erro do projeto.
- Nenhum consumidor ainda usa essas classes (ligação vem nas Fases 2 e 4, quando `CreateWebOrder` recota e a rota pública de cotação existir).

**Números:** typecheck limpo. `bun run test`: 600 pass / 0 fail (91 arquivos) — base 597 + 3 testes novos.

## T2.1 — Colunas e criação

**Arquivos** (api-quickcart):
- `drizzle/migrations/0024_order_delivery_quote.sql` + entrada `idx: 24` em `meta/_journal.json` com
  `when: 1790083998573` (maior que o `1790082918150` da 0023). Quatro colunas nullable em `orders`:
  `delivery_distance_km numeric(6,2)`, `delivery_tier_max_km numeric(5,2)`,
  `delivery_tier_fee_in_cents integer`, `delivery_location_source varchar(20)`.
- `src/infra/database/schema/orders.ts` (api) e `apps/worker-quickcart/src/infra/database/schema/orders.ts`
  (espelho, só leitura) ganham as quatro colunas.
- `OrderRepository.interface.ts` — `OrderRecord` ganha os quatro campos (obrigatórios, `number | null`);
  `CreateOrderWithItemsParams` ganha os mesmos quatro, opcionais (`?: number | string | null | undefined`).
- `DrizzleOrderRepository.ts` — `toOrderRecord` converte os `numeric` (string do Postgres) para `number`
  com `Number(...)`; `createWithStockDecrement` grava `String(...)` nas colunas numéricas e `null` quando
  ausente.
- `CreateOrderFromCart.types.ts`/`.use-case.ts` — quatro campos novos **opcionais**
  (`quotedDeliveryDistanceKm`, `quotedDeliveryTierMaxKm`, `quotedDeliveryTierFeeInCents`,
  `quotedDeliveryLocationSource`), gravados como `null` quando ausentes. **Transição**: o caminho atual do
  WhatsApp (`CheckoutHandler.confirmOrder`) continua chamando sem eles — a T3.1 monta a cotação no
  contexto do checkout e passa a preenchê-los.
- `CreateWebOrder.use-case.ts` — reescrito para **recotar** via `QuoteDeliveryFeeUseCase` injetado
  (`Pick<QuoteDeliveryFeeUseCase, 'execute'>`, registrado no container) em vez de ler
  `configuredDeliveryFeeInCents` da env. Fluxo (`quoteDelivery`): retirada → taxa 0 e as quatro colunas
  nulas, sem chamar a cotação; `out_of_range` → `DeliveryOutOfRangeError` (422); `unavailable` →
  `DeliveryUnavailableError` (422); `quoted`/`approximate_max_tier` → grava taxa, faixa e fonte (distância
  só em `quoted`; `approximate_max_tier` não calcula distância, por design da T1.1/D3). Em qualquer kind
  de entrega, se `expectedDeliveryFeeInCents` foi enviado e diverge da taxa recotada →
  `DeliveryFeeChangedError` (409); ausente, não compara.
- `CreateWebOrder.types.ts` — `expectedDeliveryFeeInCents?: number` novo, opcional (a Fase 4 faz a tela
  mandar).
- `src/infra/container/index.ts` (`buildOrderModule`) — reordenado: `resolveCepCoordinateUseCase` e um
  `DrizzleDeliveryFeeTierRepository` novo sobem antes de `createWebOrderUseCase`, para montar
  `quoteDeliveryFeeUseCase` (mesmos `environment.STORE_CEP`/`DISTANCE_DETOUR_FACTOR` que
  `ResolveOrderDeliveryEstimateUseCase` já usava) e injetá-lo no lugar de `configuredDeliveryFeeInCents`.
- `OrderSeedRunner.ts` — monta seu próprio `quoteDeliveryFeeUseCase` (mesmas peças: `DrizzleDeliveryFeeTierRepository`,
  `ResolveCepCoordinateUseCase` com os repositórios Drizzle reais e `NominatimGeocodingProvider`) em vez de
  `configuredDeliveryFeeInCents`. **Decisão registrada**: os CEPs de `OrderSeedCustomers.ts` são endereços
  reais de São Paulo que nunca foram validados contra `STORE_CEP`/as faixas — a seed não roda em
  `bun run test` (só é chamada manualmente por `seeds/index.ts` no boot de desenvolvimento), então isto
  fica fora do gate de teste automatizado; typecheck confirma que a chamada compila, mas a execução real
  da seed pode agora lançar `DeliveryOutOfRangeError`/`DeliveryUnavailableError` para os clientes de
  entrega se o CEP da loja de dev não cobrir essas distâncias. Fica como aviso para quem rodar a seed
  localmente — corrigir os CEPs de exemplo é T6.1/backlog, não bloqueia este gate.
- **`amountDue.ts` NÃO teve `resolveDeliveryFeeInCents` removida** — `CreateOrderFromCart.use-case.ts`
  ainda a usa (transição do item acima), assim como `Store.controller.ts`, `CheckoutHandler.ts` e
  `resolveCheckoutDeliveryFeeInCents.ts`. `amountDueInCents` continua intocada. Remoção fica para quando a
  Fase 3 (T3.1) tirar o WhatsApp desse caminho, ou T6.1 na limpeza final.

**Arquivos** (worker-quickcart):
- `src/infra/database/schema/orders.ts` — quatro colunas espelhadas (só leitura).
- `OrderReceiptData.types.ts`, `DrizzleOrderReceiptRepository.ts`, `ReceiptProvider.interface.ts`,
  `ProcessReceiptJob.use-case.ts` — `deliveryTierMaxKm: number | null` passa a fluir do banco até o
  provider do recibo.
- `SimpleReceiptProvider.ts` (`buildTotalLines`) — rótulo da taxa vira `"Taxa de entrega (até N km)"`
  quando `deliveryTierMaxKm !== null`; sem faixa, mantém `"Taxa de entrega"`. **`FiscalReceiptProvider.ts`
  não foi tocado** — continua somando só os itens.

**Testes novos/ajustados:**
- `CreateWebOrder.use-case.test.ts` — reescrito com `FakeQuoteDeliveryFeeUseCase` controlável por `kind`;
  cobre `quoted` (grava taxa/distância/faixa/fonte), `approximate_max_tier` (sem distância), retirada
  (zero chamadas à cotação), `out_of_range` → 422, `unavailable` → erro certo, taxa mudou → 409, taxa
  igual → cria.
- `CreateWebOrder.use-case.integration.test.ts` e `DrizzleOrderRepository.deliveryFee.integration.test.ts`
  — trocado `configuredDeliveryFeeInCents` por um `quoteDeliveryFeeUseCase` fixo (o primeiro nem chama,
  pois só testa retirada; o segundo devolve sempre `quoted`/800). Acrescentado
  `describe('DrizzleOrderRepository — snapshot da cotação (T2.1...)')`: entrega grava as quatro colunas,
  retirada grava as quatro `null` — prova de banco real que as colunas existem e aceitam `null`.
- `CreateOrderFromCart.use-case.test.ts` — dois testes novos: recebendo a cotação, grava distância/faixa/
  fonte; sem cotação (caminho atual do WhatsApp), grava as quatro colunas `null`.
- `SimpleReceiptProvider.test.ts`, `FiscalReceiptProvider.test.ts`, `ProcessReceiptJob.use-case.test.ts`
  (worker) — fixtures ganham `deliveryTierMaxKm`; teste novo prova o rótulo "(até N km)" e que a NFC-e
  (`FiscalReceiptProvider`) segue inalterada.
- Fixtures de `OrderRecord` em `RepeatLastOrder`/`GetOrderByShortCode`/`UpdateOrderStatus.use-case.test.ts`
  ganharam os quatro campos `null` (a interface passou a exigi-los). Mocks de `CheckoutHandler.*.test.ts`
  e `ConversationCheckoutContext.controller.test.ts` usam `as unknown as` e não precisaram de ajuste.

**Decisões:**
- `approximate_max_tier` nunca grava `deliveryDistanceKm` (fica `null`): a T1.1 decidiu não calcular
  distância nesse caso (seria a da cidade, não a da casa) — o snapshot só registra o que foi calculado.
- `expectedDeliveryFeeInCents` é comparado também na retirada (0) e no `approximate_max_tier`, não só no
  `quoted` — a spec fala em "a taxa cotada difere de uma taxa esperada" sem restringir a um `kind`, e
  tratar os três do mesmo jeito evita um quarto caminho sem essa checagem.
- Sem migration de dado (backfill): a spec marca as quatro colunas como nulas em pedido antigo por
  definição — não há cotação retroativa a calcular.

**Números:** typecheck limpo nos dois apps. Migration `0024` aplicada no banco de teste (`\d orders`
confere as quatro colunas nullable). `bun run test`: api-quickcart 609 pass / 0 fail (base 600 + 9 novos:
7 em `CreateWebOrder.use-case.test.ts`, 2 em `CreateOrderFromCart.use-case.test.ts`, mais os 2 de
integração do repositório substituem os 2 antigos sem aumentar a contagem líquida); worker-quickcart 21
pass / 0 fail (base 20 + 1 novo, rótulo "(até N km)").

## T3.1 — Máquina de estados do checkout no WhatsApp

**Arquivos** (em `apps/api-quickcart/src/`):
- `modules/webhook/application/parseInboundMessage.ts` + `types/WhatsAppWebhookPayload.types.ts` — novo `kind: 'location'` (lat/lng), só com coordenada finita e dentro de ±90/±180; senão `unsupported`.
- `modules/conversation/shared/ConversationState.constant.ts` — estado novo `AWAITING_OUT_OF_RANGE_DECISION`.
- `modules/conversation/shared/ConversationContext.types.ts` — `checkoutDeliveryDistanceKm`, `checkoutDeliveryTierMaxKm`, `checkoutDeliveryTierFeeInCents`, `checkoutDeliveryLocationSource`, `checkoutLocationDraft`.
- `modules/conversation/shared/deliveryQuoteContext.ts` — `withoutDeliveryQuote` (função única que apaga taxa, distância, faixa e fonte), `toDeliveryQuoteContext` (resultado → campos do contexto) e `withoutCheckoutAddress`.
- `modules/conversation/shared/resolveCheckoutDeliveryFeeInCents.ts` — só lê o contexto: retirada → 0; entrega **com** fonte de cotação → a taxa; entrega **sem** fonte → `undefined` (nunca 0 nem env).
- `modules/conversation/shared/extractRememberedLocation.ts` — localização do endereço lembrado (coordenada ou CEP de 8 dígitos; texto livre → `undefined`).
- `modules/shared/address/WhatsAppLocationAddress.ts` + `formatAddressLine.ts` — endereço de quem mandou localização (`latitude`, `longitude`, `number`, `complement?`); a linha para o cliente não mostra coordenada.
- `modules/conversation/application/handlers/support/deliveryQuoteMessages.ts`, `support/returnToAddressForMissingQuote.ts`.
- `CheckoutHandler.ts` — máquina de estados (abaixo); dependência `quoteDeliveryFeeUseCase` no lugar de `configuredDeliveryFeeInCents`.
- `enterConfirming.ts`, `CashChangeHandler.ts`, `GetConversationCheckoutContext.use-case.ts` — sem `configuredDeliveryFeeInCents`.
- `CreateOrderFromCart.use-case.ts` — não usa mais `resolveDeliveryFeeInCents`: retirada 0, entrega = `quotedDeliveryFeeInCents`.
- `infra/container/index.ts` — `quoteDeliveryFeeUseCase` exposto pelo `OrderModule` e injetado no `CheckoutHandler`; `AWAITING_ADDRESS_NUMBER` **e** `AWAITING_OUT_OF_RANGE_DECISION` registrados no roteamento.
- `Messages.constant.ts` — textos novos e botões `ADDRESS_DECISION_BUTTON_ID` (Retirar na loja / Outro endereço).

**Caminhos cobertos** (`CheckoutHandler.deliveryQuote.test.ts`, 22 casos, salvo indicação):
1. Clique em "Entrega" → `AWAITING_ADDRESS`, sem cotar e sem taxa no contexto (`deliveryFee.test`).
2. Retirada → taxa 0 direto, sem cotar (`deliveryFee.test`).
3. CEP que resolve → `AWAITING_ADDRESS_NUMBER`, sem cotar ainda.
4. Número com rascunho de CEP → cota `{ kind: 'cep' }`: `quoted` grava taxa/distância/faixa/fonte, manda "Taxa de entrega para seu endereço (2,4 km): R$ 5,00" e pergunta o pagamento; `approximate_max_tier` grava a maior faixa sem distância e manda "(estimativa pela cidade)"; `out_of_range` e `unavailable` → `AWAITING_OUT_OF_RANGE_DECISION` com a mensagem certa e os dois botões, sem endereço nem cotação no contexto.
5. CEP que não resolve e texto livre sem CEP → não gravam endereço; pedem CEP ou localização com o botão "Retirar na loja"; o botão vira retirada com taxa 0.
6. Localização → cota `{ kind: 'coordinates' }`, grava a cotação e `checkoutLocationDraft`, mostra a taxa e pede número/referência; o número grava o endereço com lat/lng e segue ao pagamento **sem recotar**; fora do raio → decisão, sem guardar a coordenada.
7. `AWAITING_OUT_OF_RANGE_DECISION`: "Retirar na loja" → retirada, taxa 0, pagamento; "Outro endereço" → `AWAITING_ADDRESS` mantendo a entrega; entrada inesperada → repete as opções sem mudar de estado.
8. "Isso mesmo": entrega lembrada recota (coordenada ou CEP lembrado) e segue; fora do raio / indisponível / endereço lembrado sem CEP nem coordenada → descarta o atalho, avisa e volta a `AWAITING_DELIVERY_TYPE`; retirada lembrada → 0 sem cotar. Invariantes do troco e da maquininha (`rememberedCheckout.test`).
9. "Alterar" → o contexto novo leva só `rememberedCheckout` (nenhum campo de cotação); o "Isso mesmo" seguinte recota. "Quero mudar" e o clique em "Entrega" passam por `withoutDeliveryQuote`.
10. `confirmOrder` passa `quotedDelivery*` do contexto e não chama a cotação (`deliveryFee.test`).
11. Sessão antiga (entrega sem fonte de cotação): `confirmOrder` não cria pedido e volta a `AWAITING_ADDRESS` (`confirmCashChange.test`); `enterConfirming` idem (`enterConfirming.test`); `CashChangeHandler` não valida troco sem taxa e volta ao endereço (`CashChangeHandler.test`). Endereço, rascunhos, cotação e troco saem do contexto; tipo, pagamento e recibo ficam.
12. Novo pagamento descarta o troco de uma escolha anterior (quem volta ao endereço e escolhe Pix não leva troco velho).
13. Coordenada nunca em log: spy em `Logger.prototype.{debug,info,warn,error}` (antes do filtro de nível) no fluxo localização → número → confirmação, com um log real disparado; nenhum contém latitude/longitude.
14. `tests/parseInboundMessage.test.ts` (3): localização válida, fora da faixa, sem o objeto.

**Testes existentes alterados (spec mudou o comportamento):**
- `CheckoutHandler.deliveryFee.test.ts` — "entrega grava a taxa configurada" virou "clique em Entrega não cota"; "confirmar usa a taxa do contexto, não a configurada" virou "passa a cotação do contexto (os cinco campos) sem recotar". A env deixou de existir no caminho.
- `CheckoutHandler.rememberedCheckout.test.ts` — o lembrado de entrega ganhou endereço e o dublê da cotação; os casos de dinheiro/cartão/pix esperam a mensagem da taxa antes (a recotação é mostrada) e o contexto com a cotação. Invariantes (troco perguntado, aviso da maquininha) mantidos.
- `CheckoutHandler.confirmCashChange.test.ts` — o caso "sessão antiga cobra a taxa configurada" virou "sessão antiga não cria pedido e volta ao endereço" (item 10 da tarefa). Revalidação do troco no `confirmOrder` segue coberta pelos outros casos.
- `CheckoutHandler.deliveryEstimate.test.ts` — o contexto de entrega ganhou a fonte da cotação (sem ela, confirmar agora volta ao endereço).
- `CashChangeHandler.test.ts` — contexto com taxa passou a ter tipo e fonte (`resolveCheckoutDeliveryFeeInCents` não aceita mais taxa solta sem entrega cotada); o caso "sessão antiga cota a env" virou "volta ao endereço".
- `enterConfirming.test.ts` — contextos de entrega com fonte; "sessão antiga cota a env" virou "não mostra resumo e volta ao endereço".
- `resolveCheckoutDeliveryFeeInCents.test.ts` — nova assinatura (só o contexto); entrega sem fonte → `undefined`, inclusive com a taxa 0 antiga da env no contexto.
- `GetConversationCheckoutContext.use-case.test.ts` — sem `configuredDeliveryFeeInCents`; o card de sessão antiga mostra taxa 0 em vez da env.
- `CheckoutHandler.alterCheckout.test.ts` — só perdeu a dependência removida. `CartHandler.rememberedCheckout*.test.ts` passaram sem alteração (a memória não carrega cotação).

**Decisões e desvios:**
- **`addressSchema` NÃO tem lat/lng** (o design.md dizia que tinha; foram removidos na revisão da spec `delivery-distance`, e o comentário do schema explica que o web não pode injetar coordenada). O endereço por localização é um tipo próprio, `WhatsAppLocationAddress`, gravado no `jsonb` do pedido; o `addressSchema` do web ficou intocado.
- **Bug pré-existente corrigido:** `AWAITING_ADDRESS_NUMBER` não estava no mapa de handlers do container — o cliente que mandava o número caía no `FALLBACK_STATE_NOT_READY`. Registrado junto com o estado novo.
- A taxa aparece em texto antes do pagamento; na localização, ela sai já ao receber a coordenada (antes do número), porque o número não muda a distância.
- "Isso mesmo" com recotação ok também mostra a taxa (o cliente de dinheiro precisa dela para o troco).
- Fora do raio no "Isso mesmo" volta à escolha do tipo de entrega (caminho longo), não à decisão Retirar/Outro endereço — como pedido na tarefa.
- `withoutDeliveryQuote` no "Alterar": o contexto novo já nasce só com `rememberedCheckout`, então a cotação some por construção; a função é usada nos caminhos que preservam o contexto.
- **Pendente para T3.2/T3.3/Fase 4:** `enterConfirming` ainda não recota sessão antiga (volta ao endereço); o card (`GetConversationCheckoutContext`) mostra taxa 0 para entrega ainda sem cotação e não mostra a faixa; `resolveDeliveryFeeInCents` e `DELIVERY_FEE_CENTS` seguem só em `Store.controller.ts`/`server.ts` (cotação web, Fase 4); a previsão de entrega (`ResolveOrderDeliveryEstimate`) lê o CEP do pedido, então pedido por localização fica sem a linha de previsão; o painel ainda não tem link de mapa para o endereço por localização. `CheckoutHandler.ts` passou de 651 para ~850 linhas — dívida de tamanho de arquivo já existente, não dividida aqui para não misturar refatoração com a máquina de estados.
- O transcript de mensagens recebidas é gravado pelo pacote `meta-whatsapp-module` (fora deste repositório); o código do QuickCart não loga coordenada em ponto nenhum.

## T3.2 — Resumo, troco e mensagens

**Contexto:** conferi o que a T3.1 já deixou pronto antes de mexer, para não duplicar.
`resolveCheckoutDeliveryFeeInCents.ts` já não tem fallback de env (lê só o contexto, `undefined`
sem `checkoutDeliveryLocationSource`). `enterConfirming.ts` já volta ao endereço quando a entrega
não tem cotação, sem inventar taxa (`CHECKOUT_DELIVERY_QUOTE_MISSING`, coberto por
`enterConfirming.test.ts`). `CashChangeHandler.acceptCashChangeAmount` já valida o troco contra
`resolveCheckoutDeliveryFeeInCents` (a taxa da faixa gravada no contexto, não uma taxa fixa) — o
caso "cobre os itens mas não itens + taxa" já tinha teste (`CashChangeHandler.test.ts:208`). Restava
só o formato do resumo (spec §3.4/§3.6): a linha da taxa não mostrava a faixa nem a distância.

**Arquivos** (em `apps/api-quickcart/src/`):
- `modules/conversation/shared/Messages.constant.ts` — dois textos novos:
  `CONFIRMING_SUMMARY_DELIVERY_FEE_QUOTED_PREFIX` ("Taxa de entrega (até {limite} km · {distancia} km):")
  e `CONFIRMING_SUMMARY_DELIVERY_FEE_APPROXIMATE_PREFIX` ("Taxa de entrega (estimativa pela cidade, até
  {limite} km):"). `CONFIRMING_SUMMARY_DELIVERY_FEE_PREFIX` (o rótulo simples de sempre) fica como
  reserva para contexto sem os campos de faixa.
- `modules/conversation/application/handlers/support/enterConfirming.ts` — `buildDeliveryFeePrefix`
  (nova função): sem `checkoutDeliveryTierMaxKm` no contexto, usa o rótulo simples; com
  `checkoutDeliveryLocationSource === cep_approximate`, usa o prefixo de estimativa (só o teto,
  sem distância — D3 nunca calcula a distância da casa); senão, com `checkoutDeliveryDistanceKm`
  presente, usa o prefixo com faixa e distância; sem distância (não deveria acontecer fora de D3,
  mas por segurança), cai no rótulo simples. Reusa `formatDistanceKm` de `deliveryQuoteMessages.ts`
  (mesma formatação com vírgula da mensagem que já sai antes do pagamento — resumo e aviso nunca
  divergem no formato do número).
- `modules/conversation/application/handlers/support/enterConfirming.test.ts` — 3 casos novos:
  cotação com faixa e distância (2,4 → "6,4 km" arredondado a 1 casa) mostra
  "Taxa de entrega (até 8 km · 6,4 km): R$ 10,00"; aproximada mostra
  "Taxa de entrega (estimativa pela cidade, até 8 km): R$ 10,00" sem "·" (sem distância); retirada
  com campos de faixa presentes no contexto (não deveria acontecer, mas por segurança) continua sem
  nenhuma linha de taxa nem "km".

**Decisões:**
- Nenhuma mudança em `resolveCheckoutDeliveryFeeInCents.ts` nem em `CashChangeHandler.ts`: já
  estavam corretos pela T3.1, e mexer neles sem motivo ia contra o escopo da task.
- O rótulo simples (`CONFIRMING_SUMMARY_DELIVERY_FEE_PREFIX`) não foi removido: os testes existentes
  da T3.1 (`entrega com taxa`, `entrega grátis`) montam o contexto sem `checkoutDeliveryTierMaxKm` e
  continuam passando sem alteração — comportamento de fallback para contexto sem os campos novos,
  não um caminho novo a testar.
- `enterConfirming` já não recota sessão antiga (retorna ao endereço) — a task pedia só *confirmar*
  isso e cobrir com teste, não implementar recotação ali; o teste
  `sessão anterior ao deploy (...): não mostra resumo, volta ao endereço` já existia da T3.1 e prova
  exatamente isso (nenhuma taxa inventada, nenhum resumo mostrado).

**Rebase:** `git fetch origin` trouxe `63cca6a` (#33, exatamente o PR anunciado: `AWAITING_ADDRESS_NUMBER`
virou `Record` completo no mapa de handlers). Conflito em `container/index.ts` na linha do mapa —
resolvido mantendo as duas entradas (`AWAITING_ADDRESS_NUMBER` do #33 e `AWAITING_OUT_OF_RANGE_DECISION`
da T3.1), como orientado.

**Números:** typecheck limpo. `bun run test`: 638 pass / 0 fail (93 arquivos) — base 635 + 3 testes novos.

## T3.3 — Card da conversa

**Arquivos** (`apps/api-quickcart/src/`):
- `modules/order/shared/DeliveryFeeQuote.constant.ts` — `DELIVERY_LOCATION_SOURCE_VALUES` (tupla dos
  três valores), para `z.enum(...)` sem duplicar a lista.
- `modules/conversation/shared/CheckoutContext.schema.ts` — `deliveryFeeInCents` virou `CENTS.nullable()`
  (`null` = sem cotação, nunca 0 inventado); três campos novos, todos opcionais/nulos:
  `deliveryDistanceKm`, `deliveryTierMaxKm`, `deliveryLocationSource`. Schema continua `.strict()` — só
  esses três campos entraram, nada de coordenada nem CEP.
- `modules/conversation/application/use-cases/GetConversationCheckoutContext.use-case.ts` — a
  **pendência da T3.1**: antes, `resolveCheckoutDeliveryFeeInCents(context) ?? 0` escondia "sem
  cotação" atrás de "taxa zero". Agora `deliveryFeeInCents` é `null` quando a entrega ainda não foi
  cotada (`resolveCheckoutDeliveryFeeInCents` devolveu `undefined`); `deliveryTierMaxKm`,
  `deliveryDistanceKm` e `deliveryLocationSource` vêm direto do contexto, `null` na retirada (mesmo que
  sobre alguma faixa de uma entrega anterior no mesmo contexto) e na ausência do campo.
  `amountDueInCents` continua somando itens + taxa (0 quando não cotada) — o rótulo "Total" vs.
  "Subtotal (sem entrega)" é decisão do frontend, que já sabe distinguir `null` de `0`.
- `modules/conversation/application/use-cases/GetConversationCheckoutContext.use-case.test.ts` — testes
  ajustados para os campos novos (`toEqual` e a lista de chaves) e 4 casos novos: sessão antiga sem
  cotação (os quatro campos `null`, mas `amountDueInCents` segue = subtotal); cotação aproximada (D3:
  faixa sem distância); retirada com faixa "sobrando" no contexto (por segurança, os três campos saem
  `null` mesmo assim); resposta sem latitude/longitude/CEP mesmo com `checkoutLocationDraft` no
  contexto da sessão.
- `modules/conversation/infra/http/ConversationCheckoutContext.controller.test.ts` — fixture do
  contrato ganhou os três campos novos (exigidos pelo tipo).

**Arquivos** (`apps/frontend-web/src/`):
- `shared/api/api.types.ts` — `ConversationCheckoutContext` espelha o contrato novo:
  `deliveryFeeInCents: number | null`, `deliveryDistanceKm`, `deliveryTierMaxKm`,
  `deliveryLocationSource: 'whatsapp_location' | 'cep' | 'cep_approximate' | null`.
- `modules/conversations/shared/orderInProgress.constant.ts` — `DELIVERY_FEE_TO_CALCULATE` ("a
  calcular"), `SUBTOTAL_WITHOUT_DELIVERY` ("Subtotal (sem entrega)") e
  `DELIVERY_LOCATION_SOURCE_LABELS` (`whatsapp_location` → "pela localização", `cep` → "pelo CEP",
  `cep_approximate` → "estimativa pela cidade").
- `modules/conversations/components/OrderInProgressCard.tsx` — `deliveryTierText` monta "até N km · X
  km, fonte" (ou só "até N km, fonte" na estimativa, sem distância); a linha da taxa mostra
  `${valor} (${faixa})` quando há faixa no contexto. `isDeliveryQuoted = deliveryFeeInCents !== null`
  decide entre "a calcular"/valor formatado e entre o rótulo "Total"/"Subtotal (sem entrega)" — a
  pendência exata que a T3.1 deixou registrada.
- `modules/conversations/components/OrderInProgressCard.test.tsx` — fixtures ganharam os três campos
  (exigidos pelo tipo); 4 casos novos: entrega sem cotação (mostra "a calcular" e "Subtotal (sem
  entrega)", nunca "0,00"); cotação aproximada (mostra a faixa e "estimativa pela cidade", sem
  distância, sem `NaN`); cotação por localização/CEP (mostra faixa, distância e fonte); nenhuma
  latitude/longitude aparece no HTML renderizado.

**Decisões:**
- `deliveryFeeInCents` continuou `number | null` (não virou uma união mais rica tipo
  `{ kind: 'quoted' | 'missing', ... }`): o contrato já tinha esse campo consumido por dois lados
  (schema Zod da API e tipo do frontend), e `null` já é o sinal padrão de "ausente" no resto do
  contrato (`address`, `paymentMethod`, `cashChangeForInCents`) — introduzir uma segunda convenção só
  para este campo quebraria a leitura do resto do objeto.
- Retirada zera faixa/distância/fonte mesmo que o contexto tenha sobrado de uma entrega anterior
  (ex.: cliente trocou de "Entrega" para "Retirar na loja" depois de já ter cotado): o card nunca deve
  sugerir uma faixa que não vale mais para o pedido atual. Coberto por teste dedicado.
- `checkoutLocationDraft` (coordenada temporária da T3.1, antes do endereço final) não tem campo
  correspondente no schema de resposta — `.strict()` já bloqueia se alguém tentasse repassar o
  contexto inteiro; o teste "sem latitude/longitude" prova isso mesmo colocando a coordenada no
  contexto de entrada.
- Nenhuma mudança em `OrderDetailView.tsx` (pedido já criado, fora do escopo desta task — fica para a
  Fase 4/5 conforme o design.md, que já lista essa tela ao lado do card da conversa).

**Números:** typecheck limpo nos dois apps. `bun run test`: api-quickcart 641 pass / 0 fail (93
arquivos) — base 638 (pós-T3.2) + 3 testes novos; frontend-web 27 pass / 0 fail (5 arquivos) — base 24
+ 3 testes novos.

## T4.1 — Rota e tela

**Arquivos** (`apps/api-quickcart/src/`):
- `modules/store/infra/http/schemas/CheckoutQuote.schema.ts` — `cep` (8 dígitos) acrescentado ao
  corpo; `.superRefine` exige `cep` quando `deliveryType === 'delivery'` (ausente → `ValidationError`,
  422, igual ao padrão de `CreateWebOrder.schema.ts`).
- `modules/store/infra/http/Store.controller.ts` — dependência `deliveryFeeInCents` (env) trocada por
  `quoteDeliveryFeeUseCase: Pick<QuoteDeliveryFeeUseCase, 'execute'>`; `handleGetCheckoutQuote` cota
  pelo CEP (`{ kind: 'cep', cep }`, ou sem `location` na retirada) e monta `deliveryQuote` +
  `isDeliveryAvailable` a partir do `QuoteDeliveryFeeResult` — só `kind`, `distanceKm` (arredondada a
  0,1 km com `roundToOneDecimalKm`), `maxDistanceKm` e `tier`; nunca coordenada nem CEP.
  `resolveDeliveryFeeInCents` removido do import.
- `modules/order/shared/amountDue.ts` — `resolveDeliveryFeeInCents` removido (único consumidor era o
  `Store.controller.ts`); `amountDueInCents` intocada. `amountDue.test.ts` perdeu o describe da função
  removida.
- `modules/order/infra/http/schemas/CreateWebOrder.schema.ts` — **lacuna da T2.1 fechada**: o schema
  não tinha `expectedDeliveryFeeInCents` (o use case já lia o campo, mas o zod descartava por não
  estar declarado — a comparação de 409 nunca disparava vindo de um corpo HTTP real). Campo acrescentado,
  opcional, `z.coerce.number().int().nonnegative()`.
- `infra/container/index.ts` — `container.order` ganhou `quoteDeliveryFeeUseCase: orderModule.quoteDeliveryFeeUseCase`
  (já existia no módulo, só não estava exposto para o `server.ts` montar o `StoreController`).
- `infra/http/server.ts` — `StoreController` passa a receber `quoteDeliveryFeeUseCase:
  container.order.quoteDeliveryFeeUseCase` em vez de `deliveryFeeInCents: environment.DELIVERY_FEE_CENTS`.
  `environment.DELIVERY_FEE_CENTS` deixou de ser lida em `server.ts` e em `Store.controller.ts`; a
  variável em si (`environment.ts`) sai só na Fase 6, como combinado.
- Testes: `CheckoutQuote.schema.test.ts` (+3: exige CEP na entrega, aceita retirada sem CEP, recusa CEP
  mal formatado); `Store.controller.test.ts` reescrito com `quoteDeliveryFeeUseCase` fake — cobre
  `quoted`, `approximate_max_tier` (sem distância), `out_of_range` (distância + limite, taxa zero,
  indisponível), `unavailable` (taxa zero, indisponível), "resposta nunca traz coordenada nem CEP"
  (`JSON.stringify` do payload não contém o CEP enviado nem "latitude"/"longitude"), e "entrega sem
  CEP é recusada com ValidationError (422)"; `CreateWebOrder.schema.test.ts` (+1: aceita
  `expectedDeliveryFeeInCents` opcional).

**Arquivos** (`apps/frontend-web/src/`):
- `shared/api/api.types.ts` — `CheckoutQuoteInput` ganha `cep?: string | undefined`
  (`exactOptionalPropertyTypes: true` exige o `| undefined` explícito); `CheckoutQuote` ganha
  `deliveryQuote: CheckoutDeliveryQuote` (união por `kind`, espelhando `DELIVERY_QUOTE_KIND` do
  backend) e `isDeliveryAvailable: boolean`.
- `shared/api/client.ts` — o interceptor de resposta jogava fora o `code` do erro (`new
  Error(message)` só com a mensagem) — **sem isso, `getApiErrorCode()` não tinha nada para ler**.
  Nova classe `ApiError extends Error` carrega `code`; `getApiErrorCode(error)` lê `error.code`
  quando é uma `ApiError`. `CreateOrderInput` ganha `expectedDeliveryFeeInCents?: number`.
- `modules/order/infra/http/schemas/CreateWebOrder.schema.ts`: nenhuma mudança do lado do frontend
  (mencionado para deixar claro que o corpo é o mesmo tipo `CreateOrderInput` de sempre).
- `modules/store/shared/queries/useCheckoutQuote.query.ts` — chave `['checkout-quote', deliveryType,
  cepDigits, items]`; `resolveCheckoutQuoteRequest` (função pura extraída, sem `renderHook` neste
  projeto) decide `enabled` (entrega só dispara com exatamente 8 dígitos de CEP; retirada sempre
  dispara com carrinho não vazio) e manda só os dígitos do CEP no corpo (a tela pode ter máscara).
- `modules/store/shared/checkoutDelivery.constant.ts` (novo) — `resolveDeliveryQuoteMessage` (sem CEP
  completo → "Informe o CEP para calcular a taxa"; `out_of_range` → mensagem de fora do raio
  sugerindo retirada; `unavailable` → mensagem genérica) e `resolveCreateOrderErrorMessage` (traduz o
  `code` de `getApiErrorCode()`: `DELIVERY_FEE_CHANGED` → avisa que a taxa mudou e sinaliza
  `shouldRefetchQuote: true`; `DELIVERY_OUT_OF_RANGE` → mensagem de fora do raio; outro código → cai
  na mensagem original do erro).
- `modules/store/hooks/useCheckoutPage.hook.ts` — `checkoutQuoteQuery` passa a receber `cep`;
  `deliveryQuoteMessage` (memoizado) chama `resolveDeliveryQuoteMessage`; `handleSubmit` manda
  `expectedDeliveryFeeInCents: quote.deliveryFeeInCents` quando a cotação já chegou, e no `catch` usa
  `resolveCreateOrderErrorMessage` — `shouldRefetchQuote` dispara `checkoutQuoteQuery.refetch()`.
- `modules/store/pages/Checkout.page.tsx` — a linha da taxa só aparece com `isDeliveryAvailable`, com
  `deliveryTierLabel` mostrando "até N km · X km" (`quoted`) ou "até N km (estimativa pela cidade)"
  (`approximate_max_tier`); sem isso, `deliveryQuoteMessage` explica o motivo; o total mostra "—"
  enquanto a entrega não está disponível; o botão de confirmar fica desabilitado com entrega
  indisponível ou cotação ainda não chegada.
- Testes novos: `useCheckoutQuote.query.test.ts` (5 casos: retirada dispara sem CEP; entrega sem CEP
  não dispara; CEP incompleto não dispara; CEP com máscara dispara e manda só dígitos; carrinho vazio
  não dispara mesmo com CEP) e `checkoutDelivery.constant.test.ts` (8 casos: as quatro combinações de
  `resolveDeliveryQuoteMessage` e as três de `resolveCreateOrderErrorMessage`, incluindo o código
  desconhecido caindo na mensagem original).

**Decisões:**
- `getApiErrorCode()` não existia em lugar nenhum do monorepo antes desta task, apesar de citado como
  convenção (`code-standart.md` §7 do usuário). Criado em `client.ts`, ao lado do `apiClient` — é o
  único lugar que already intercepta toda resposta de erro, então é o único lugar que pode preservar
  o `code` sem duplicar a leitura de `error.response.data.error` em cada chamador.
- `createWebOrderBodySchema` não tinha `expectedDeliveryFeeInCents`: a T2.1 já usava o campo no use
  case e no tipo, mas nunca o declarou no schema do corpo — como o zod descarta chave não declarada,
  o valor nunca chegava vindo de uma requisição HTTP real (só nos testes de use case, que chamam o
  use case direto). Sem esse campo no schema, a Fase 4 não tinha como completar "a tela manda a taxa
  esperada" — corrigido aqui porque é exatamente o contrato que esta task fecha.
- `roundToOneDecimalKm` fica só no `Store.controller.ts` (não extraído para `shared/`): é
  `Math.round(x*10)/10`, uma linha, e o card da conversa (`OrderInProgressCard.tsx`, T3.3) já tem a
  própria versão inline (`formatKm`) para o mesmo arredondamento — um terceiro lugar duplicando não
  paga o custo de uma abstração para uma linha.
- `deliveryFeeInCents` na resposta continua 0 (não omitido) em `out_of_range`/`unavailable`: o campo
  já existia no contrato antes desta task e `isDeliveryAvailable: false` é o sinal de que ele não deve
  ser cobrado — trocar para `undefined`/omitir quebraria quem já lê `CheckoutQuote.deliveryFeeInCents`
  como `number`.
- Botão de confirmar desabilitado quando `deliveryType === 'delivery'` e a cotação ainda não chegou ou
  não está disponível: evita o cliente confirmar um pedido que o servidor vai recusar de qualquer
  jeito (a validação real continua no `CreateWebOrder`, isto é só UX).
- Nenhuma mudança em `OrderRoutes.ts`/`StoreRoutes.ts`: a rota `POST /v1/store/checkout-quote` já
  existia e seu rate limit (`checkoutQuoteRateLimiter`) não muda.

**Números:** typecheck limpo nos dois apps (`exactOptionalPropertyTypes: true` exigiu `cep?: string |
undefined` explícito em `CheckoutQuoteInput`). `bun run test`: api-quickcart 648 pass / 0 fail (93
arquivos) — base 641 + 3 (`CheckoutQuote.schema.test.ts`) + 5 (`Store.controller.test.ts`: aproximado,
fora do raio, indisponível, nunca coordenada, sem CEP → 422) + 1 (`CreateWebOrder.schema.test.ts`) − 2
(`amountDue.test.ts` perdeu os dois casos de `resolveDeliveryFeeInCents`, removida) = +7; frontend-web
40 pass / 0 fail (7 arquivos) — base 27 + 5 (`useCheckoutQuote.query.test.ts`) + 8
(`checkoutDelivery.constant.test.ts`) = +13.

## T5.1 — Edição das faixas

**Arquivos** (`apps/api-quickcart/src/`):
- `modules/order/application/use-cases/ReplaceDeliveryFeeTiers.use-case.ts` (novo) — lê a lista antiga
  via `deliveryFeeTierRepository.listOrdered()`, chama `replaceAll` (já transacional desde a T1.2) e
  loga `info` de auditoria (`security.md` §10) com `actorUserId`, `previousTiers` e `newTiers` — nunca
  o e-mail, só o id.
- `modules/order/infra/http/DeliveryFeeTiers.controller.ts` (novo) — `handleList` (GET) e
  `handleReplace` (PUT), `requireSession({ roles: ADMIN_ONLY })` nos dois, `userModule` injetável como
  o `ConversationCheckoutContextController` (o teste exercita 401/403 com token de verdade). PUT valida
  com `deliveryFeeTiersInputSchema` via `validateBody` (já devolve todos os erros de uma vez, T1.2) —
  **exceto lista vazia**: `deliveryFeeTiersInputSchema` exige 1–10 faixas (regra do CONTEÚDO de uma
  lista não vazia, testada em T1.2), mas o painel PODE mandar `[]` de propósito para desligar a
  entrega (spec §3.1, §4 item 9). Só o array vazio (`Array.isArray(body) && body.length === 0`) passa
  direto para o use case; qualquer outro valor cai na validação normal.
- `modules/order/infra/http/OrderRoutes.ts` — `GET`/`PUT /v1/admin/delivery-fee-tiers`, mesmo arquivo
  de rotas do módulo (a interface do repositório já mora em `order/domain`).
- `infra/container/index.ts` (`buildOrderModule`) — reaproveita o `deliveryFeeTierRepository` que a
  T2.1 já monta ali para o `quoteDeliveryFeeUseCase`; monta `replaceDeliveryFeeTiersUseCase` e
  `deliveryFeeTiersController`, expostos em `container.order`.
- `infra/http/server.ts` — `registerOrderRoutes` recebe `deliveryFeeTiersController`.
- Testes: `DeliveryFeeTiers.controller.test.ts` (token real via `TokenService`, como
  `ConversationCheckoutContext.controller.test.ts`) — GET admin 200, GET atendente 403, GET sem sessão
  401, PUT atendente 403 (lista intocada), PUT sem sessão 401, PUT inválido devolve as duas violações
  da mesma linha numa mensagem só (422, lista intocada), PUT válido substitui a lista, PUT com `[]`
  aceito e desliga a entrega. `ReplaceDeliveryFeeTiers.use-case.test.ts` — substitui e devolve a nova
  lista, aceita lista vazia, lê a lista antiga antes de trocar (auditoria).

**Arquivos** (`apps/frontend-web/src/`):
- `shared/api/api.types.ts` — `Order` ganha os quatro campos do snapshot da cotação (T2.1) que a api
  já devolvia mas o tipo não declarava: `deliveryDistanceKm`, `deliveryTierMaxKm`,
  `deliveryTierFeeInCents`, `deliveryLocationSource` (mais o tipo `DeliveryLocationSource`). Novo tipo
  `DeliveryFeeTier` (`maxDistanceKm`/`feeInCents`).
- `shared/api/client.ts` — `adminListDeliveryFeeTiers()` e `adminReplaceDeliveryFeeTiers(tiers)`.
- `modules/admin/shared/deliveryFeeTiers.constant.ts` (novo) — `parseDeliveryFeeTiersErrorMessage`
  desfaz a mensagem única que `validateBody` (api) junta com `; ` (`"0.maxDistanceKm: ...; ...`"),
  devolvendo `Map<índice da linha, mensagens>` para o erro aparecer NA LINHA da tabela; erro sem
  índice numérico (ex.: tamanho da lista) cai na chave `-1`. `resolveOutOfRangeWarning` monta "Fora de
  N km a loja não entrega" (N = maior faixa) ou "Sem faixas, só retirada" com a lista vazia.
- `modules/admin/shared/queries/useAdminDeliveryFeeTiers.query.ts` e
  `modules/admin/shared/mutations/useReplaceDeliveryFeeTiers.mutation.ts` — mesmo padrão de
  `useAdminCategoriesQuery`/`useAdjustStockMutation`.
- `modules/admin/hooks/useAdminDeliveryFeesPage.hook.ts` (novo) — rascunho em TEXTO por linha
  (`maxDistanceKmText`/`feeInReaisText`): campo vazio ou "3," não pode virar `NaN` enquanto a pessoa
  ainda digita. Só substitui o rascunho quando a query resolve pela primeira vez (não a cada
  revalidação em segundo plano, senão apagaria edição em andamento). `save()` bloqueia local se algum
  campo não converte para número; erro do servidor (`getApiErrorCode(error) === 'VALIDATION_ERROR'`)
  vira `rowErrors` por `parseDeliveryFeeTiersErrorMessage`.
- `modules/admin/pages/AdminDeliveryFees.page.tsx` (novo) — tabela "Até (km)"/"Taxa (R$)", adicionar
  (até 10, botão desabilita no limite) e remover linha, aviso de fora de raio/sem faixas, erro por
  linha embaixo do campo de taxa, "Salvar" manda a lista inteira.
  `app/routes.tsx`: `/admin/delivery-fees`. `components/Layout.tsx`: item "Faixas de entrega" (🚚) na
  seção Administração, `roles: ADMIN_ONLY`.
- `modules/admin/components/OrderDetailView.tsx` — no card "Total", nova linha "Faixa até N km · X km"
  (com "aprox., CEP genérico" quando `deliveryLocationSource === 'cep_approximate'`, que nunca tem
  distância por decisão da T1.1/T2.1). Lida do PEDIDO (`order.deliveryTierMaxKm`/`deliveryDistanceKm`/
  `deliveryLocationSource`), nunca da configuração de faixas vigente — a faixa é substituída a cada
  PUT do painel, e recalcular pela config atual mostraria uma taxa que o cliente nunca pagou. Ausente
  quando `deliveryTierMaxKm` é `null` (retirada, pedido antigo).
- `modules/preview/pages/OrderDetailPreview.page.tsx` e `OrdersPreview.page.tsx` — fixtures ganham os
  quatro campos novos (a interface `Order` passou a exigi-los); o preview de detalhe ganha valores
  reais para exercitar a nova linha, o de lista usa `null` (a lista não mostra faixa).
- Testes: `deliveryFeeTiers.constant.test.ts` (separa mensagem por linha, junta duas violações da
  mesma linha, erro sem índice cai em `-1`, aviso com/sem faixas) e
  `OrderDetailView.deliveryTier.test.tsx` (cotação exata mostra faixa + distância, `cep_approximate`
  mostra faixa sem distância com "aprox.", pedido sem cotação não mostra nada).

**Decisões:**
- Controller e use case novos ficam em `modules/order/`, não num módulo próprio: a interface do
  repositório (`DeliveryFeeTierRepository.interface.ts`) e o repositório Drizzle já vivem ali desde a
  T1.2, e o `quoteDeliveryFeeUseCase` (T2.1) já é montado dentro de `buildOrderModule` — um módulo
  novo só para o painel duplicaria a montagem do mesmo repositório.
- `deliveryFeeTiersInputSchema` (T1.2) não foi alterado para aceitar lista vazia: ele já tem teste
  explícito "rejeita lista vazia" e é usado só por este controller, então mudar o mínimo ali
  contradiria o T1.2 documentado. A saída ficou no controller (bypass explícito só para `[]`), que é
  o único ponto que precisa das duas regras ("conteúdo válido" + "vazio desliga a entrega").
- Sem teste de integração HTTP fim-a-fim (Router real + servidor): o projeto não tem esse padrão em
  nenhuma rota (confirmado por busca — nenhum `*.integration.test.ts` sobe o `Router`); o padrão
  existente para 401/403 é token real do `TokenService` contra o controller direto (`requireSession.
  test.ts`, `ConversationCheckoutContext.controller.test.ts`), replicado aqui.
- Sem toast nem componente de erro compartilhado: o projeto não tem biblioteca de toast, e a única
  convenção existente para erro de API (`useCheckoutPage.hook.ts`) é estado local + texto inline —
  replicada aqui como `generalError` (texto abaixo do botão Salvar) e `rowErrors` (texto abaixo do
  campo, por linha).

**Números:** typecheck limpo nos dois apps. `bun run test` (Postgres/Redis de teste de pé, migrations
aplicadas): api-quickcart 659 pass / 0 fail (97 arquivos) — base 648 + 8
(`DeliveryFeeTiers.controller.test.ts`) + 3 (`ReplaceDeliveryFeeTiers.use-case.test.ts`) = +11;
frontend-web 48 pass / 0 fail (11 arquivos) — base 40 + 5 (`deliveryFeeTiers.constant.test.ts`) + 3
(`OrderDetailView.deliveryTier.test.tsx`) = +8.

## T6.1 — Remover env e atualizar documentação

**Variáveis removidas:**
- `environment.ts` — `DELIVERY_FEE_CENTS` e `STORE_DELIVERY_RADIUS_KM` removidas do schema.
- `.env.example` — linha com `DELIVERY_FEE_CENTS=0` removida.
- `envs/env.dev` — linhas com `STORE_DELIVERY_RADIUS_KM=8` e `DELIVERY_FEE_CENTS=0` removidas.
- Seed (`OrderSeedRunner.ts`) — não lê essas variáveis (usa `QuoteDeliveryFeeUseCase` que já recebe
  repositório de faixas).

**Código afetado:**
- `ResolveOrderDeliveryEstimate.use-case.ts` — `deliveryRadiusKm` removido de dependências; agora
  injeta `DeliveryFeeTierRepositoryInterface` e obtém o raio máximo como fim da última faixa
  (`tiers.length > 0 ? tiers[tiers.length - 1]!.maxDistanceKm : 0`).
- `container/index.ts:286` — atualizado para injetar `deliveryFeeTierRepository` em vez de
  `deliveryRadiusKm: environment.STORE_DELIVERY_RADIUS_KM`.
- Testes:
  - `ResolveOrderDeliveryEstimate.test.ts` — `buildUseCase` agora recebe `maxDeliveryRadiusKm`
    (injetado como última faixa no mock `InMemoryDeliveryFeeTierRepository`).
  - `DrizzleOrderRepository.deliveryFee.integration.test.ts` — nome do teste alterado para remover
    menção a env ("retirada grava taxa 0").

**Documentação atualizada:**
- `init-claude.md` — seção "Roteiro de atendimento" simplificada (removida menção a `DELIVERY_FEE_CENTS`
  como env fixa); nova seção "Taxa de entrega por faixa de distância" descreve tabela, cotação,
  painel, colunas do pedido.
- `.specs/features/delivery-distance/spec.md` — Q2 (linha 229) atualizado para avisar que
  `STORE_DELIVERY_RADIUS_KM` foi removido; o raio máximo agora vem da última faixa.
- `.specs/features/roteiro-atendimento/spec.md` — seção 3.4 atualizada com nota de que a taxa deixou
  de ser fixa por env e passa a ser por faixa.

**Grep final (código + configs):**
```
$ grep -rn "DELIVERY_FEE_CENTS\|STORE_DELIVERY_RADIUS_KM" \
  --include="*.ts" --include="*.tsx" --include="*.env.*" \
  apps/api-quickcart apps/worker-quickcart apps/frontend-web envs .env.example
```
Resultado: vazio (nenhuma ocorrência).

**Gates:**
- `docker start quickcart-test-postgres quickcart-test-redis` — OK.
- `bun run typecheck` — limpo em api-quickcart, worker-quickcart, frontend-web.
- `bun run test`:
  - `apps/api-quickcart`: 659 pass / 0 fail (base 659 conforme esperado).
  - `apps/frontend-web`: 48 pass / 0 fail (base 48 conforme esperado).

**Commits:**
Commit único com as mudanças acima. Mensagem em português com o porquê, conforme rules.

## T6.2 — correções da revisão

### A) Geocodificação
- `NominatimGeocodingProvider`: slot reservado antes de dormir (3 chamadas simultâneas saem a 0 / 1,1 / 2,2 s),
  teto de `MAX_PENDING_GEOCODE_CALLS = 10` (fila cheia → transitório), `AbortSignal.timeout(3000)`.
- Provider devolve união `found | not_found | transient_error`; transitório (rede, timeout, 429/5xx, fila cheia)
  não grava `geocode_failures`.
- `ResolveCepCoordinate`: CEP da loja (`storeCep`) nunca lê nem grava o cache negativo; dedup em andamento
  (`Map<cep, Promise>`); memória LRU com teto `COORDINATE_MEMORY_CACHE_MAX_ENTRIES = 5000`.
- Gates: typecheck limpo (api, worker, frontend); api 666 pass / 0 fail; frontend 48 pass / 0 fail.

### B) Faixas vazias persistem
- Migration aditiva `0025_delivery_fee_settings` (linha única `id = 1`, `tiers_seeded_at`; journal `when` =
  1790089631319 > 1790083998573). Base que já tinha faixas ganha o marcador na própria migration.
- `replaceAll` grava o marcador na mesma transação (vale para o seed e para o PUT do painel);
  `EnsureDefaultDeliveryFeeTiers` só semeia sem marcador. Worker não lê faixas — sem espelho.
- Testes: vazia depois de PUT não é semeada; primeira subida semeia; legado com faixa só ganha marcador;
  integração do marcador no Postgres.
- Gates: typecheck limpo; api 669 / 0 fail; frontend 48 / 0 fail.

### C) Distância coerente
- `QuoteDeliveryFee` arredonda a 0,1 km uma vez (`roundDistanceKm`, `src/shared/formatDistanceKm.ts`) antes de
  escolher a faixa; o valor segue igual para mensagem, resposta web e snapshot. `roundToOneDecimalKm` do
  `Store.controller` removido; `formatDistanceKm` do bot passou para o mesmo módulo.
- `DeliveryOutOfRangeError`: "Endereço a 12,3 km … (até 8,5 km)." e `details.distanceKm` arredondado.
- Testes: 3,04 km → faixa "até 3 km" com `distanceKm: 3`; mensagem/detalhe do erro.
- Gates: typecheck limpo; api 671 / 0 fail; frontend 48 / 0 fail.

### D) Coordenada fora das respostas (LGPD)
- `modules/order/shared/withoutAddressCoordinates.ts`: remove `latitude`/`longitude` do `address`. Aplicado em
  `withAllowedTransitions` (lista, detalhe e mutações admin), `POST /orders`, `GET /orders/:shortCode` (público)
  e `GET` "meus pedidos" (`Store.controller`).
- `Conversation.controller` `handleGetContext`: `withoutContextCoordinates` omite `checkoutLocationDraft` e tira
  lat/lng de `checkoutAddress` e `rememberedCheckout.address`.
- `CreateWebOrder`: rua/bairro/cidade/UF sobrescritos pelo ViaCEP do CEP (`addressLookupProvider`); CEP
  desconhecido → `DeliveryUnavailableError('cep_not_found')` (constante `DELIVERY_UNAVAILABLE_REASON.CEP_NOT_FOUND`);
  `params.address!` trocado por guard; `'unexpected_quote_kind'` removido — o tipo fecha por narrowing.
- Testes: público/lista/detalhe/mutação sem lat/lng; meus pedidos; contexto; ViaCEP sobrescreve; CEP desconhecido;
  entrega sem endereço.
- Gates: typecheck limpo; api 681 / 0 fail; frontend 48 / 0 fail.

### E) Pequenos
- `infra/config/warnWhenStoreCepMissing.ts` chamado no boot (`src/index.ts`): `warn`
  `store_cep_missing_delivery_disabled` `{ deliveryAvailable: false }` — sem PII.
- `CheckoutHandler` em `AWAITING_ADDRESS_NUMBER`: mensagem `location` segue o mesmo `acceptLocation` do
  `AWAITING_ADDRESS` (e descarta o rascunho de CEP).
- `ResolveOrderDeliveryEstimate.test.ts`: `toBeDefined` trocados por valores (1,96 km, 15–30 min).
- Não alterado (decisão do usuário a registrar): `GEOCODE_PRECISION.NONE` → maior faixa.
- Gates: typecheck limpo; api 684 / 0 fail; frontend 48 / 0 fail.

## T6.2 — seed sem provedor externo

`make seed ENV=test` quebrava no CI (`seed_failed - Não foi possível calcular a taxa de entrega`).
Causa: `CreateWebOrder` passou a cotar a entrega, e o `env.test` não tem `STORE_CEP` (ausente de
propósito, para teste de integração não geocodificar de verdade) — a cotação devolvia `unavailable`
e derrubava a seed inteira. No CI ainda se soma a falta de saída para ViaCEP/Nominatim.

Correção:
- `SeedOfflineAddressProviders.ts`: geocodificação e ViaCEP da seed com coordenada fixa por CEP
  (Piumhi com precisão de município, que é o caso D3). Sem rede e determinístico.
- `OrderSeedRunner.ts`: garante as faixas padrão antes dos pedidos (a seed roda em banco recém
  migrado, antes de qualquer boot) e trata `DeliveryOutOfRangeError`/`DeliveryUnavailableError` como
  cliente de exemplo pulado, com `warn`, em vez de matar a seed. Pedido fora da última faixa deixou
  de ser possível por decisão da spec.

Verificado: `make seed ENV=test` sai 0; typecheck limpo; api 684 pass / 0 fail.

## Confirmação de endereço aproximado

**Decisão do usuário (2026-09-22):** cotação `approximate_max_tier` no fluxo do bot deixava de cobrar
a maior faixa em silêncio ("estimativa pela cidade") e passa a **confirmar o endereço com o cliente
antes de cobrar**. A cotação web pública **não mudou de contrato** — `Store.controller.ts` segue
devolvendo `approximate_max_tier` como antes; nada foi tocado na Fase 4.

**Arquivos** (`apps/api-quickcart/src/`):
- `modules/conversation/shared/ConversationState.constant.ts` — estado novo
  `AWAITING_APPROXIMATE_ADDRESS_DECISION`. Registrado em `infra/container/index.ts` (o mapa é
  `Record<ConversationState, ...>`: sem a entrada o `tsc` reprova, e foi exatamente o que aconteceu
  na primeira compilação).
- `modules/conversation/shared/ConversationContext.types.ts` — `checkoutApproximateDecision`
  (`feeInCents`, `tierMaxKm`, `tierFeeInCents`, `retryCount?`, `locationAttempts?`,
  `awaitingLocation?`). **Estimativa pendente não é cotação**: enquanto ela existe, o contexto não
  tem `checkoutDeliveryLocationSource`, então `resolveCheckoutDeliveryFeeInCents` devolve
  `undefined` e nenhum caminho cobra taxa por engano.
- `modules/conversation/shared/deliveryQuoteContext.ts` — `withoutDeliveryQuote` passa a apagar
  também `checkoutApproximateDecision`: a estimativa pendente é cotação e não pode sobreviver a um
  endereço novo. Isso faz "Alterar endereço", "Quero mudar", o clique em "Entrega" e a retirada
  limparem a pendência sem código novo em cada caminho.
- `modules/conversation/shared/Messages.constant.ts` — `APPROXIMATE_ADDRESS_BUTTON_ID`
  (`SEND_LOCATION`, `CHANGE_ADDRESS`, `CONFIRM_ESTIMATE`), `APPROXIMATE_ADDRESS_DECISION_BUTTONS`
  (Enviar localização / Alterar endereço / Retirar na loja — 3 botões, o teto do WhatsApp) e
  `APPROXIMATE_ESTIMATE_BUTTONS` (Confirmar / Retirar na loja), reusando o `PICKUP_INSTEAD_BUTTON`
  que já existia. Textos novos: `CHECKOUT_APPROXIMATE_ADDRESS_DECISION` (mostra o endereço
  encontrado via `{endereco}`), `CHECKOUT_APPROXIMATE_ASK_LOCATION` (uma linha de como enviar),
  `CHECKOUT_APPROXIMATE_UNEXPECTED_INPUT`, `CHECKOUT_APPROXIMATE_HELP`,
  `CHECKOUT_APPROXIMATE_ESTIMATE_OFFER`.
- `modules/conversation/application/types/CheckoutHandler.types.ts` — `AcceptCepDraftParams`,
  `PendingApproximateQuote`, `EnterApproximateDecisionParams`, `ApproximateDecisionStepParams`,
  `OfferApproximateEstimateParams` (toda função com 2+ parâmetros recebe objeto tipado).
- `modules/conversation/application/handlers/CheckoutHandler.ts` — o fluxo:
  1. `handleAwaitingAddressNumber`, no caminho do CEP, verifica o `kind` do resultado: só
     `approximate_max_tier` desvia para `enterApproximateDecision`, que grava o endereço completo e
     a estimativa **pendente** (nenhum campo de cotação) e manda os três botões. O corpo da mensagem
     sai de `formatAddressLine` — rua, número, bairro e cidade/UF, **nunca o CEP** (teste explícito).
  2. `handleAwaitingApproximateAddressDecision`: localização → recota pela coordenada e vai ao
     pagamento mantendo o endereço já informado (fonte `whatsapp_location`); "Alterar endereço" →
     `askAddressAgain`; "Retirar na loja" → `choosePickup` (taxa 0); "Enviar localização" →
     `askApproximateLocation`; "Confirmar" → `confirmApproximateEstimate`.
  3. Texto com 8 dígitos vale como endereço novo (mesmo `acceptCepDraft` do passo do endereço).
  4. `repeatApproximateQuestion`: esperando localização, a 1ª mensagem inválida repete o "como
     enviar" e a 2ª (`APPROXIMATE_LOCATION_ATTEMPT_LIMIT`) oferece a estimativa com o preço e os
     botões Confirmar / Retirar; fora disso, a 1ª repete a pergunta e a 2ª
     (`APPROXIMATE_HELP_AFTER_RETRIES`) manda a ajuda, sempre **sem sair do estado**.
  5. `confirmApproximateEstimate` é o **único** ponto que transforma a estimativa em cotação, com
     `DELIVERY_LOCATION_SOURCE.CEP_APPROXIMATE` — daí `confirmOrder` grava
     `delivery_location_source = cep_approximate` sem nenhuma mudança no caminho do pedido.

**Refatorações pequenas (sem mudança de comportamento):** `acceptCepDraft` (extraída de
`handleAwaitingAddress`, agora usada também pelo estado novo) e `askAddressAgain` (extraída e
reusada pelo "Outro endereço" do `AWAITING_OUT_OF_RANGE_DECISION`, que era código idêntico).
`CEP_DIGITS_LENGTH` substitui o `8` literal.

**Decisões e limites de escopo:**
- **Só a coordenada volta a decidir a taxa; o endereço do CEP continua sendo o endereço do pedido.**
  Quando a localização chega no estado novo, o número e o complemento já foram informados — pedir de
  novo (como faz `acceptLocation` no caminho do zero) seria repetir pergunta. A coordenada serve à
  distância, o endereço estruturado serve ao entregador.
- **`quoteRememberedDelivery` ("Isso mesmo") não mudou**: a entrega lembrada com CEP aproximado
  segue sendo recotada e aceita. Aquele endereço já foi usado num pedido anterior — o cliente já o
  confirmou —, e o caso não está entre os requisitos desta mudança. O teste existente
  (`"Alterar" não leva a cotação adiante; "Isso mesmo" depois recota`) documenta esse caminho.
- Contexto sem `checkoutApproximateDecision` no estado novo (sessão que atravessou deploy) volta ao
  passo do endereço em vez de inventar taxa.
- Nenhum log novo: coordenada, CEP e endereço não aparecem em log em nenhum dos caminhos.

**Testes** (`CheckoutHandler.deliveryQuote.test.ts`, +8 casos; 1 reescrito):
- reescrito: `approximate_max_tier` agora vai para `AWAITING_APPROXIMATE_ADDRESS_DECISION` com a
  estimativa pendente, sem nenhum campo de cotação, e a mensagem mostra rua/cidade e **não** o CEP.
- "Enviar localização" pede a localização e marca `awaitingLocation`; localização recebida no estado
  novo cota pela coordenada (`whatsapp_location`) e vai ao pagamento mantendo o endereço; "Alterar
  endereço" volta ao endereço apagando endereço e pendência; "Retirar na loja" fecha em retirada com
  taxa 0; CEP de 8 dígitos em texto vale como endereço novo; texto inválido repete uma vez e depois
  manda a ajuda sem sair do estado; duas mensagens que não são localização levam à oferta da
  estimativa com o preço e os botões Confirmar/Retirar; confirmar a estimativa grava a cotação
  aproximada e o pedido sai com `quotedDeliveryLocationSource = cep_approximate` e distância `null`.
- `GetConversationCheckoutContext.use-case.test.ts` (+1): sessão parada no estado novo devolve
  `deliveryFeeInCents`/faixa/fonte `null`, mantém os itens e o `amountDueInCents` do subtotal, e a
  resposta não vaza `checkoutApproximateDecision`.

**Números:** typecheck limpo nos três apps. `bun run test`: api-quickcart 693 pass / 0 fail (97
arquivos) — base 684 + 9 testes novos; frontend-web 48 pass / 0 fail (sem alteração);
worker-quickcart 21 pass / 0 fail (sem alteração).
