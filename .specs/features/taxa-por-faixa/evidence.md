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
