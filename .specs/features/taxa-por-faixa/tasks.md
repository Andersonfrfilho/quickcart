# Tasks — Taxa de entrega por faixa de distância

Spec: [`spec.md`](./spec.md) · Design: [`design.md`](./design.md) · Criado em 2026-09-22 ·
Branch: `feat/taxa-por-faixa`

Uma task por vez, na ordem. Cada task fecha com commit isolado. Evidência em [`evidence.md`](./evidence.md).

**Gates de TODA task** (`~/.claude/rules/rules/model-economy.md` §3):
`bun run typecheck` limpo nos apps tocados · `bun run test` (script do projeto, **nunca** `bun test` cru)
com `quickcart-test-postgres` e `quickcart-test-redis` de pé e **todas** as migrations aplicadas ·
**rodar a suíte, confirmar 0 falhas, e só então comitar, em comando separado** · dublês sem `as never`.

> **Outra sessão também mergeia no `main`.** Antes de comitar: `git fetch origin`; se andou,
> `git rebase origin/main` e rodar a suíte de novo. Se o Docker cair, `open -a Docker`.

> **Migrations:** journal manual, `when` = epoch ms **real** e **maior** que o da última entrada — um
> `when` menor faz o drizzle pular a migration em silêncio num banco que já aplicou a anterior (staging).

---

## Fase 0 — Pré-requisito: pacote com mensagem de localização
> 🤖 Modelo: `sonnet` — **só verifica**

### T0.1 — Conferir o pacote publicado
- O `@adatechnology/meta-whatsapp-contracts` publicado tem `location` em `whatsAppMessageSchema`
  (`npm view @adatechnology/meta-whatsapp-contracts version` + conferir o `.d.ts` da versão).
- **Se não estiver:** **PARAR e perguntar** — publicar pacote é outra cadeia (PR no repositório de
  pacotes → merge → Publish).
- **Se estiver:** subir `meta-whatsapp-contracts`/`meta-whatsapp-module` para essa versão em
  `apps/api-quickcart` **e** `apps/worker-quickcart`, `bun install`, conferir que a API resolve **uma**
  cópia só do módulo, typecheck e suíte. Commit.

---

## Fase 1 — Dados e regra
> 🤖 Modelo: `sonnet` (**T1.1 é 🧠** — `opus`)

### T1.1 🧠 — `QuoteDeliveryFee` e a função de distância
- `modules/order/application/use-cases/QuoteDeliveryFee.use-case.ts` + `.types.ts` (união da spec §3.3).
- Extrair distância para `modules/shared/address/deliveryEstimate.ts`; `ResolveOrderDeliveryEstimate`
  passa a usá-la.
- Testes: cada `kind`; faixas de D4 (2 km → 500, 6 km → 1000, 12 km → fora); precisão cidade →
  `approximate_max_tier`; sem faixas → `unavailable`; sem `STORE_CEP` → `unavailable`.

### T1.2 — Tabela, repositório e validação
- `infra/database/schema/delivery-fee-tiers.ts`, migration `00NN_delivery_fee_tiers.sql`,
  `DrizzleDeliveryFeeTierRepository` + interface, `modules/order/shared/DeliveryFeeTiers.schema.ts`.
- Testes: validação (crescente, 1–10, 0,1–50 km, taxa 0–100000, todos os erros de uma vez); CHECK do
  banco recusa taxa negativa.

### T1.3 — Seed de boot
- `EnsureDefaultDeliveryFeeTiers` — tabela vazia → 3 km/500 e 8 km/1000; não sobrescreve. Ligar no boot.

### T1.4 — Cache negativo e ritmo do provedor
- `geocode_failures` (migration), consulta antes do provedor, TTL 24 h; semáforo 1 chamada/s; coordenada
  da loja em memória.
- Testes: CEP que falhou não chama o provedor de novo dentro de 24 h; duas cotações simultâneas não
  fazem duas chamadas por segundo.

### T1.5 — Erros
- `DELIVERY_OUT_OF_RANGE` (422), `DELIVERY_FEE_CHANGED` (409), `DELIVERY_UNAVAILABLE` em
  `shared/errors/codes.ts`, classes de domínio.

---

## Fase 2 — O pedido guarda a cotação
> 🤖 Modelo: `sonnet`

### T2.1 — Colunas e criação
- Migration com as 4 colunas (spec §3.7); schemas da api **e** do worker; repositório e DTO.
- `CreateOrderFromCart` recebe a cotação do contexto; `CreateWebOrder` recota (409 / 422).
- Remover `resolveDeliveryFeeInCents` de `amountDue.ts` (manter `amountDueInCents`).
- Worker: recibo simples mostra "Entrega (até N km)". **Não mexer no `FiscalReceiptProvider`.**
- Testes: colunas gravadas; recotação web com 409 e 422; NFC-e continua com a soma dos itens.

---

## Fase 3 — WhatsApp
> 🤖 Modelo: `sonnet` (**T3.1 é 🧠** — `opus`)

### T3.1 🧠 — Máquina de estados
- Cotação move para depois do endereço (CEP e **localização**); estado `AWAITING_OUT_OF_RANGE_DECISION`;
  texto livre sem CEP não serve para entrega; `withoutDeliveryQuote`; "Isso mesmo" recota.
- Localização (`message.location`): cota pela coordenada, pede número/complemento/referência, guarda
  lat/lng no endereço. **Coordenada nunca em log.**
- Testes: cada caminho da spec §3.4, incluindo sessão antiga sem cotação no contexto.

### T3.2 — Resumo, troco e mensagens
- `enterConfirming` (faixa no resumo, recota sessão antiga), `resolveCheckoutDeliveryFeeInCents` (sem
  fallback de env), textos novos em `Messages.constant.ts`.
- Testes: troco validado contra itens + taxa da faixa.

### T3.3 — Card da conversa
- `GetConversationCheckoutContext` e `OrderInProgressCard` mostram faixa e distância.

---

## Fase 4 — Cotação pública e checkout web
> 🤖 Modelo: `sonnet`

### T4.1 — Rota e tela
- `CheckoutQuote.schema.ts` com `cep`; `Store.controller.ts` usa `QuoteDeliveryFee`.
- Frontend: tipos, cliente, query (chave com o CEP), `Checkout.page` com a taxa e os erros
  `DELIVERY_FEE_CHANGED` / `DELIVERY_OUT_OF_RANGE` via `getApiErrorCode()`.
- Testes: cotação com CEP; sem CEP para entrega → 422; a resposta não traz coordenada.

---

## Fase 5 — Painel
> 🤖 Modelo: `sonnet`

### T5.1 — Edição das faixas
- `GET`/`PUT /v1/admin/delivery-fee-tiers` (só admin), `ReplaceDeliveryFeeTiers` em transação, log de
  auditoria. Tela `/admin/delivery-fees`, rota e menu.
- Detalhe do pedido mostra faixa, distância e fonte.
- Testes: 403 para não-admin; PUT inválido devolve todos os erros; PUT válido substitui a lista.

---

## Fase 6 — Limpeza e revisão
> 🤖 Modelo: `haiku` para a limpeza · revisão com `opus`

### T6.1 — Remover env e atualizar documentação
- Remover `DELIVERY_FEE_CENTS` e `STORE_DELIVERY_RADIUS_KM` do `environment.ts`, `envs/*`,
  `.env.example`, seed (`OrderSeedRunner.ts`).
- Atualizar `init-claude.md` e as specs `delivery-distance` e `roteiro-atendimento`.

### T6.2 — Revisão independente
- `code-reviewer` e `security-reviewer` em `opus` sobre o diff inteiro (rota pública que geocodifica,
  coordenada fora dos logs, snapshot no pedido). Corrigir os achados.
- Abrir o PR **sem mergear**.

---

## Prompt de execução

```text
/oh-my-claudecode:autopilot Execute a spec .specs/features/taxa-por-faixa/ no repositório
/private/tmp/qc-faixa (branch feat/taxa-por-faixa). Leia spec.md, design.md e tasks.md inteiros antes de
tocar em código. Uma task por vez, na ordem do tasks.md.

Fase 0 primeiro: se o @adatechnology/meta-whatsapp-contracts publicado não tiver `location` no schema de
mensagem, PARE e pergunte — não publique pacote.

Modelos: Fase 0 → executor model=sonnet · Fase 1 → executor model=sonnet, mas T1.1 🧠 com opus ·
Fase 2 → sonnet · Fase 3 → sonnet, mas T3.1 🧠 com opus · Fase 4 e 5 → sonnet · Fase 6 → executor
model=haiku para T6.1, e code-reviewer + security-reviewer model=opus para T6.2.

Cada task fecha com: bun run typecheck (apps tocados) + bun run test com o banco de teste migrado +
commit isolado, rodando a suíte ANTES do commit e em comando separado. Antes de comitar, git fetch; se o
main andou, rebase e rode a suíte de novo. Evidência de cada task em
.specs/features/taxa-por-faixa/evidence.md.

Pare e pergunte antes de: publicar ou mudar pacote @adatechnology/*, mergear qualquer branch, fazer deploy
ou mergear o PR (o merge publica em staging), ou qualquer migration que não seja aditiva.
```
