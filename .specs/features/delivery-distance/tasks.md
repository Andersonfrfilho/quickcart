# Tasks — Endereço estruturado, distância e previsão de chegada

Spec: [`spec.md`](./spec.md) · Criado em 2026-08-02

Ordem obrigatória: a Fase 1 é pré-requisito de todas as outras — sem endereço estruturado não há o
que geocodificar (spec §1.1). Cada task tem commit isolado, para rollback barato.

**Terreno levantado no código, não presumido:**

| Fato | Onde |
|---|---|
| Última migração | `apps/api-quickcart/drizzle/migrations/0009_order_items_unavailable_notified.sql` |
| Journal é manual | `drizzle/migrations/meta/_journal.json` — entrada nova escrita à mão, como nas 0006–0009 |
| Endereço do pedido | `src/infra/database/schema/orders.ts:35` — `jsonb('address')`, sem tipo |
| Endereço do cliente | `src/infra/database/schema/customers.ts:18` — `jsonb('default_address')`, sem tipo |
| Entrada web sem validação | `src/modules/order/infra/http/schemas/CreateWebOrder.schema.ts` — `z.unknown().optional()` |
| Captura no WhatsApp | `src/modules/conversation/application/handlers/CheckoutHandler.ts` — `message.body.trim()`, string crua |
| Captura no web | `apps/frontend-web/src/modules/store/hooks/useCheckoutPage.hook.ts` — input único |
| Endereço da loja | `environment.ts:113` (api) e `:107` (worker) — `z.string().optional()`, usado só no recibo |
| Exibição no admin | `OrderDetailView.tsx` — `formatAddress` com `Object.values(...).join(', ')` |

---

## Fase 1 — Modelo de endereço e migração expand
> 🤖 Modelo: `sonnet`

### T1.1 — `addressSchema` como única definição
- **Arquivo:** `apps/api-quickcart/src/modules/shared/address/Address.schema.ts` (novo)
- **Conteúdo:** o schema da spec §3, mais `type Address = z.infer<typeof addressSchema>`
- **Regra:** `number` é `string` ("s/n", "123A" são endereços reais); `latitude`/`longitude`/
  `geocodePrecision` são preenchidos pela geocodificação, **nunca pelo cliente** — o schema de
  entrada HTTP omite os três (`addressInputSchema = addressSchema.omit({...})`)
- **Dependência:** nenhuma
- **Verificação:** `make test ENV=test` e `tsc --noEmit`
- **Aceite:** existe um só lugar que define endereço; nenhum outro arquivo declara campo de endereço

### T1.2 — Migração expand (aditiva)
- **Arquivo:** `drizzle/migrations/0010_structured_address.sql` + entrada em `meta/_journal.json`
- **Conteúdo:**
  - `orders.legacy_address_text text` e `customers.legacy_address_text text` — o texto original
    preservado; nenhum pedido histórico é reescrito com endereço adivinhado (spec §6)
  - tabela `geocoded_addresses`: `cep varchar(9) primary key`, `latitude numeric(10,7)`,
    `longitude numeric(10,7)`, `precision varchar(20)`, `provider varchar(40)`,
    `resolved_at timestamptz not null default now()`
  - tabela `stores` com endereço estruturado e coordenada (spec §8 Q3), `company_id` incluído nos
    índices porque o schema é multiempresa
- **Regra:** só `ADD COLUMN`/`CREATE TABLE`. Nada de `DROP`, nada de `NOT NULL` retroativo — os dois
  `jsonb` têm dado em produção nos dois formatos
- **Proibido:** dinheiro/coordenada em `real` ou `double precision`; `numeric` sempre
- **Verificação:** `make migrate ENV=test` e `make migrate ENV=dev`, depois `make test`
- **Aceite:** migração roda nas duas bases e nenhuma consulta existente quebra

### T1.3 — Entrada web validada de verdade
- **Arquivos:** `CreateWebOrder.schema.ts`, `CreateWebOrder.types.ts`, `CreateWebOrder.use-case.ts`
- **Conteúdo:** `z.unknown().optional()` some; entra `addressInputSchema.optional()` (opcional
  porque retirada não tem endereço — e endereço em pedido de retirada deve ser **rejeitado**, não
  ignorado em silêncio)
- **Dependência:** T1.1
- **Verificação:** `CreateWebOrder.use-case.test.ts` e o `.integration.test.ts` já existentes,
  mais um caso negativo: retirada com endereço → 400
- **Aceite:** requisição com endereço malformado responde 400 com todos os erros de validação, não
  o primeiro (`apis.md`)

### T1.4 — Leitura conviver (legado + estruturado)
- **Arquivos:** `OrderDetailView.tsx`, `formatAddress`
- **Conteúdo:** lê o estruturado quando existe e cai no texto legado quando não existe. O
  `Object.values(...).join(', ')` sai — ele depende da ordem de inserção das chaves e some no dia
  em que alguém acrescentar um campo
- **Dependência:** T1.2
- **Verificação:** `/preview/order` com fixture nos três casos (estruturado, legado, sem endereço)
- **Aceite:** pedido antigo continua exibindo o texto original; nenhum endereço inventado

---

## Fase 2 — Captura nos dois canais
> 🤖 Modelo: `sonnet`

### T2.1 — CEP primeiro no web
- CEP → ViaCEP preenche rua/bairro/cidade/UF; cliente completa número e complemento
- CEP que não resolve **não trava**: cai para os campos manuais (spec §8 Q1)
- **Aceite:** o caminho de dados é um só; o que muda é de onde os campos vêm preenchidos

### T2.2 — CEP + número em passos no WhatsApp
- `CheckoutHandler` hoje aceita uma mensagem só; passa a ter passo de CEP e passo de número
- **Aceite:** endereço estruturado por construção, sem parse de texto livre

---

## Fase 3 — Geocodificação, distância e ETA
> 🤖 Modelo: `sonnet`

### T3.1 — Provider com cache por CEP
- CEP → Nominatim (coordenada), cacheado em `geocoded_addresses`. **BrasilAPI anuncia coordenada e
  devolve `{}`** — medido na spec §4.1; não usar aquele campo
- `User-Agent` identificando a aplicação (exigência da política de uso do Nominatim)
- **Aceite:** segundo pedido do mesmo CEP não faz chamada externa (teste com o provider espionado)

### T3.2 — Haversine + ETA como faixa
- `DISTANCE_DETOUR_FACTOR` (1.35), `DELIVERY_AVERAGE_SPEED_KMH` (25), `STORE_PREPARATION_MINUTES`
  (20) — todos por env validada, nunca literal no código
- **Aceite:** ETA exibida como faixa ("35–50 min"), e **omitida** com `precision: 'city'` ou sem
  coordenada. Nada de distância/ETA em `pickup`

---

## ~~Fase 4 — Backfill do legado~~ ❌ CANCELADA
> Revisada em `opus` antes de escrever em dado real, como a marca 🧠 exigia.
> Decisão registrada em [`docs/adr/0001-sem-backfill-de-endereco-legado.md`](../../../docs/adr/0001-sem-backfill-de-endereco-legado.md).

**Não implementar.** O regex `\d{5}-?\d{3}` em texto livre extrai celular (`98888-7777` →
`98888-777`) e CPF (`01415000123` → `01415000`, que é um CEP real em São Paulo) — geocodifica com
sucesso e produz distância errada sem nada na tela para desconfiar. Além disso
`customers.default_address` é coluna morta (nunca escrita, nunca lida, 18/18 nulos em dev), e
`addressSchema` exige `number`, que não é recuperável de texto livre.

Nada depende disso: sem coordenada, a Fase 3 não exibe ETA (spec §5), e o legado é uma cauda que
encurta sozinha porque todo pedido novo já nasce estruturado.

**Entregue no lugar:** `make address-inventory` — conta as formas gravadas, só leitura, sem PII na
saída, seguro em qualquer ambiente. É o que mede produção antes de qualquer conversa sobre volume.

---

## Fase 5 — Seeders e UI
> 🤖 Modelo: `haiku`

- Seeders passam a gerar clientes e pedidos com CEPs **reais** em faixas de distância variadas,
  incluindo um fora do raio — hoje não criam cliente nem pedido, então não há o que ver na tela
- Seed roda os use-cases, nunca `INSERT` bruto (`code-standart.md` §5)
- Aviso de "fora da área" no admin **sinaliza, não bloqueia** (spec §8 Q2)

---

## Revisão final
> 🤖 Modelo: `opus`

Dois critérios de aceite da spec §9 mudaram de sentido com o cancelamento da Fase 4:

- ~~"Pedido antigo sem CEP extraível continua exibindo o texto original"~~ → agora **todo** pedido
  antigo exibe o texto original, porque nenhum é reescrito. Já entregue e verificado em T1.4.
- O item de backfill sai da lista.

Percorrer os 11 critérios de aceite da spec §9, mais a auditoria do `code-standart.md` §15 (N+1,
I/O assíncrono, log sem PII) e o §1 do `security.md`: **CEP não é PII, mas endereço completo é** —
não entra em log nem em nome de chave de objeto no storage.
