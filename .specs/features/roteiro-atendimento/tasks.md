# Tasks — Lacunas do roteiro de atendimento

Spec: [`spec.md`](./spec.md) · Criado em 2026-09-21 · Branch: `feat/roteiro-atendimento`

Ordem obrigatória: **Fase 0 antes de tudo**. Depois as fases seguem em ordem, uma task por vez, cada
uma com commit isolado. Evidência de cada task em [`evidence.md`](./evidence.md) (criar na primeira).

**Terreno levantado no `main` (49ab47f), não presumido:**

| Fato | Onde |
|---|---|
| Última migration | `0019_order_item_substitution.sql` depois do PR #21 (a substituição renumerou `0015`–`0019`). Journal manual (`meta/_journal.json`), `when` em epoch ms **real** e **maior que o da 0019** — um `when` menor faz o drizzle pular a migration em silêncio num banco que já aplicou a 0019, como o staging |
| Formas de pagamento | `src/modules/order/shared/Order.constant.ts:39-43` — `pix`, `card_on_delivery`, `cash` |
| Colunas do pedido | `src/infra/database/schema/orders.ts:22-49` — `total_in_cents`, `payment_method`, `address` jsonb |
| Estados da conversa | `src/modules/conversation/shared/ConversationState.constant.ts:16-35` |
| Checkout | `src/modules/conversation/application/handlers/CheckoutHandler.ts` (~490 linhas) — `handleAwaitingPayment:262`, `enterConfirming:426`, `buildConfirmingSummary:448`, `confirmOrder:349` |
| Botões de pagamento / confirmação | `src/modules/conversation/shared/Messages.constant.ts:266-270` e `CONFIRMING_BUTTONS` |
| NFC-e usa o total como pagamento | `apps/worker-quickcart/src/modules/receipt/infra/providers/FiscalReceiptProvider.ts:84,140` |
| Previsão de entrega (hoje só painel) | `src/modules/order/application/use-cases/ResolveOrderDeliveryEstimate.use-case.ts:51-84` |
| Env da loja | `src/infra/config/environment.ts:161-183` — `STORE_CEP`, `STORE_PREPARATION_MINUTES`, `STORE_DELIVERY_RADIUS_KM` |
| Palavras de saída globais | `Messages.constant.ts:107` — `EXIT_WORDS` |
| Handler global | `src/modules/conversation/application/handlers/GlobalHandler.ts` |
| Pedir atendente (menu) | `src/modules/conversation/application/registerQuickCartFlowActions.ts:176-180` |
| Checkout lembrado | `src/modules/conversation/application/rememberedCheckout.ts` |
| Pedido web | `src/modules/order/application/use-cases/CreateWebOrder.use-case.ts:136` |
| Reprecificação por falta | `src/modules/order/application/use-cases/NotifyUnavailableItems.use-case.ts:65-67` |

**Gates de TODA task** (`~/.claude/rules/rules/model-economy.md` §3):
`cd apps/api-quickcart && bun run typecheck` · `bun run test` (a suíte **com** o banco de teste
migrado — ver nota) · frontend tocado: `cd apps/frontend-web && bun run typecheck` · commit isolado.

> **Nota sobre o banco de teste:** a suíte precisa do `quickcart-test-postgres` (porta 5443) com
> **todas** as migrations, inclusive `make customer-migrate ENV=test`. Sem elas, 11 testes de
> integração falham por tabela ausente — isso é ambiente, não regressão. Rodar as migrations antes
> de concluir que algo quebrou.

---

## Fase 0 — Pré-requisito: substituição com autorização no main
> 🤖 Modelo: `sonnet` — **só verifica, não mergeia**

### T0.1 — Conferir que a branch da substituição está no main
- **Checar:** `git merge-base --is-ancestor 30fa0d2 origin/main` (commit do ADR 0003).
- **Se NÃO estiver:** **PARAR e perguntar ao usuário.** Não mergear, não fazer rebase, não tocar
  no worktree `/Users/anderson.filho/Documents/personal/quickcart` — ele tem trabalho não commitado
  de outra sessão na branch `chore/notification-sdk-bump`.
- **Se estiver:** `git rebase origin/main` nesta branch e seguir.
- **Aceite:** `awaiting_customer_decision` existe em `Order.constant.ts` do main.

---

## Fase 1 — Pagamento e confirmação
> 🤖 Modelo: `sonnet`

### T1.1 — Troco no dinheiro
- **Migration:** `0020_order_cash_change.sql` — `ALTER TABLE orders ADD COLUMN IF NOT EXISTS
  cash_change_for_in_cents integer;` (nulo = não precisa). Entrada no journal com `when` = epoch ms
  real, maior que a última. Schema Drizzle: `cashChangeForInCents: integer('cash_change_for_in_cents')`.
- **Estados novos:** `AWAITING_CASH_CHANGE` (pergunta sim/não) e `AWAITING_CASH_CHANGE_AMOUNT`
  (valor). Em **arquivo próprio** — `handlers/CashChangeHandler.ts` ou `support/cashChange.ts` —,
  não dentro do `CheckoutHandler`.
- **Fluxo:** `handleAwaitingPayment` com `cash` → `AWAITING_CASH_CHANGE` com botões
  "Não preciso" / "Preciso de troco". "Preciso" → pede o valor. Depois segue para a preferência de
  recibo, como hoje.
- **Parser:** função pura `parseCashAmountToCents(text): number | undefined` — aceita `150`,
  `150,00`, `R$ 150`, `150.00`, `1.500,00`. Ponto só é milhar quando há vírgula decimal, ou quando
  seguido de exatamente 3 dígitos.
- **Validação:** valor ≤ `amountDueInCents` → mensagem "Esse valor não cobre a compra de R$ X" e
  repete a pergunta. (Até a T2.1 existir, `amountDue` = total dos itens.)
- **Persistência:** o valor vai no contexto do checkout e é gravado no pedido em `confirmOrder`.
- **Exibição:** resumo antes de confirmar, confirmação final, `OrderDetailView` do painel.
- **Testes:** parser (casos acima + inválidos: `abc`, vazio, negativo); recusa de valor ≤ total;
  gravação no pedido; "Não preciso" grava nulo.
- **Aceite:** critérios 1 e 2 da spec.

### T1.2 — Cartão na entrega: aviso e selo da maquininha
- **Função pura:** `requiresCardMachine(order): boolean` em `modules/order/shared/` —
  `payment_method === card_on_delivery && delivery_type === delivery`. É a **única** que decide.
- **Bot:** ao escolher cartão, envia a mensagem da spec §3.2 antes de seguir.
- **Painel:** selo "Levar maquininha" no `OrderDetailView` e na lista de pedidos, consumindo a função
  (exposta no DTO do detalhe como `requiresCardMachine`, não recalculada no frontend).
- **Motorista:** onde a tela do motorista mostra o pedido, o mesmo selo.
- **Testes:** função (entrega+cartão = sim; retirada+cartão = não; entrega+pix = não); mensagem
  enviada ao escolher cartão.
- **Aceite:** critério 3.

### T1.3 — Previsão de entrega na confirmação
- Em `confirmOrder`, **depois** de criar o pedido, chamar `ResolveOrderDeliveryEstimateUseCase`.
  Com `minMinutes`/`maxMinutes`, acrescentar a linha na confirmação. Sem estimativa: linha ausente.
- **Retirada:** "Pronto para retirada em cerca de N minutos" com `STORE_PREPARATION_MINUTES`.
- **Falha não derruba:** `try/catch` **só** em volta da estimativa (é fallback gracioso, permitido
  pelo `code-standart.md` §7), log `delivery_estimate_unavailable` com o `orderId`, confirmação
  enviada sem a linha.
- **Testes:** com estimativa → linha presente; sem `STORE_CEP` → ausente; estimativa lançando erro
  → confirmação sai assim mesmo.
- **Aceite:** critério 4.

---

## Fase 2 — Taxa de entrega e resumo completo
> 🤖 Modelo: `sonnet` (**T2.1 é 🧠** — validar com `opus` antes de implementar)

### T2.1 🧠 — Taxa de entrega fora do total fiscal
- **Env:** `DELIVERY_FEE_CENTS: z.coerce.number().int().nonnegative().default(0)` em
  `environment.ts` da api. Documentar em `envs/env.dev` e `.env.example`.
- **Migration:** `0021_order_delivery_fee.sql` — `ALTER TABLE orders ADD COLUMN IF NOT EXISTS
  delivery_fee_in_cents integer NOT NULL DEFAULT 0;`. Aditiva; pedidos antigos ficam com 0.
- **Função única:** `amountDueInCents(order) = total_in_cents + delivery_fee_in_cents` em
  `modules/order/shared/`. **Nenhum outro lugar soma os dois.**
- **Onde grava a taxa:** criação de pedido pelo WhatsApp (`confirmOrder`) e pela web
  (`CreateWebOrder`). Retirada grava 0.
- **Onde NÃO mexe:** `total_in_cents` continua sendo só os itens; `FiscalReceiptProvider`
  continua usando `totalInCents`; `NotifyUnavailableItems` recalcula só os itens.
- **Onde usa `amountDue`:** resumo, confirmação, validação do troco (T1.1), painel, motorista,
  recibo por WhatsApp/e-mail.
- **🧠 Validar antes:** que nenhum outro consumidor de `totalInCents` precisa do valor com a taxa
  (listar todos com busca e justificar cada um no `evidence.md`).
- **Testes:** `amountDue` soma; retirada = 0; taxa gravada no pedido WhatsApp e web; item em falta
  recalcula `total_in_cents` e preserva `delivery_fee_in_cents`; **teste que falha se
  `total_in_cents` passar a incluir a taxa**.
- **Aceite:** critérios 5 e 6.

### T2.2 — Resumo antes de confirmar
- Reescrever `buildConfirmingSummary` para o formato da spec §3.4: itens, **Subtotal**, **Taxa de
  entrega** ("grátis" quando 0; ausente na retirada), **Total**, entrega, pagamento com troco,
  recibo.
- Strings novas em `Messages.constant.ts` (regra das strings repetidas, `code-standart.md` §16).
- **Testes:** snapshot de texto nos três casos (entrega com taxa, entrega grátis, retirada) e com
  troco.

### T2.3 — Botão "Alterar" no resumo
- `CONFIRMING_BUTTONS` passa a **Confirmar / Alterar / Cancelar**.
- "Alterar" → estado `CART_REVIEW` com o carrinho intacto e o contexto de checkout preservado; ao
  fechar o pedido de novo, o `rememberedCheckout` oferece reaproveitar entrega e pagamento.
- **Testes:** "Alterar" não apaga carrinho nem contexto; o reaproveitamento é oferecido.
- **Aceite:** critério 7.

---

## Fase 3 — Atendente em qualquer etapa
> 🤖 Modelo: `sonnet` (**T3.2 é 🧠** — investigar o ponto de extensão com `opus`)

### T3.1 — Palavra-chave global para atendente
- **Constante:** `HUMAN_HANDOFF_PHRASES` em `Messages.constant.ts`.
- **Função pura:** `isHumanHandoffRequest(text): boolean` — normaliza (minúsculas, sem acento, sem
  pontuação) e casa a **frase inteira**, ou "quero falar com" / "falar com" + expressão.
- **`GlobalHandler`:** em qualquer estado, se for pedido de atendente, dispara **a mesma ação** do
  botão do menu (`registerQuickCartFlowActions.ts:176-180`) — extrair para uma função compartilhada
  em vez de duplicar.
- **Não calar o bot** (spec §3.5).
- **Testes:** positivos (`atendente`, `Quero falar com um atendente!`, `falar com alguém`); negativos
  (`o atendente de ontem errou meu pedido`, `humanos erram`); dispara em `CHECKOUT`, `CART_REVIEW`
  e `AWAITING_LIST`.
- **Aceite:** critério 8.

### T3.2 🧠 — "Pedido em andamento" no painel da conversa
- **Primeiro, investigar** como o `@adatechnology/conversations-ui` deixa o host injetar conteúdo
  no painel de contexto da conversa (skill `adatechnology-ui`).
- **Se houver ponto de extensão:** endpoint `GET /v1/conversations/:id/checkout-context` no
  QuickCart (escopo `admin`/`atendente`, autorização por objeto) devolvendo carrinho + contexto de
  checkout; componente no frontend usando o slot do pacote.
- **Se NÃO houver:** **PARAR e perguntar** — a mudança seria no pacote, e publicar pacote é outra
  cadeia (packages → npm → produto).
- **Testes:** endpoint (403 para separador/motorista; 404 para conversa de outro tenant; dados
  corretos); componente renderiza os campos.
- **Aceite:** critério 9.

---

## Fase 4 — Fechamento
> 🤖 Modelo: `sonnet` · revisão com `opus`

### T4.1 — Auditoria e documentação
- Auditoria do `code-standart.md` §15: N+1 (a previsão faz 2 geocodificações — conferir cache),
  logs sem PII (**valor do troco e endereço não vão para log**), strings repetidas extraídas.
- Atualizar o contexto da IA na raiz (`code-standart.md` §14) com os estados e colunas novos.
- Suíte inteira verde.

### T4.2 — Revisão independente
- `code-reviewer` com `model=opus` sobre o diff inteiro da branch. Achados corrigidos antes do PR.
- Abrir o PR **sem mergear**: o merge publica em staging pelo gatilho do Railway.

---

## Prompt de execução

```text
/oh-my-claudecode:autopilot Execute a spec .specs/features/roteiro-atendimento/ no repositório
/private/tmp/qc-roteiro (branch feat/roteiro-atendimento). Leia spec.md e tasks.md inteiros antes de
tocar em código. Uma task por vez, na ordem do tasks.md.

Fase 0 primeiro: se o commit 30fa0d2 não estiver em origin/main, PARE e pergunte — não mergeie, não
faça rebase de outra branch e não toque no worktree /Users/anderson.filho/Documents/personal/quickcart.

Modelos: Fase 0 e 1 → executor model=sonnet · Fase 2 → executor model=sonnet, mas T2.1 🧠 com opus
(validar com architect model=opus antes de implementar) · Fase 3 → executor model=sonnet, mas T3.2 🧠
com opus · Fase 4 → executor model=sonnet + code-reviewer model=opus.

Cada task fecha com: bun run typecheck (api e, se tocado, frontend) + bun run test com o banco de
teste migrado (inclusive make customer-migrate ENV=test) + commit isolado. Registre a evidência de
cada task em .specs/features/roteiro-atendimento/evidence.md.

Pare e pergunte antes de: mergear qualquer branch, fazer deploy ou mergear o PR (o merge publica em
staging), mudar um pacote @adatechnology/* (T3.2), ligar DELIVERY_FEE_CENTS > 0 em qualquer ambiente,
ou qualquer migration que não seja aditiva.
```
