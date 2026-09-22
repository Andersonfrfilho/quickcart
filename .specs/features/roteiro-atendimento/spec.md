# Spec — Fechar as lacunas do roteiro de atendimento de supermercado

Criado em 2026-09-21 · Origem: `Roteiro_Atendimento_Inteligente_Supermercado_Franca_City.pdf`
(documento de direcionamento da ADA para o atendimento via WhatsApp).

## 1. Contexto

O roteiro descreve a jornada: nome → menu → lista (texto ou áudio) → confirmação da lista →
endereço → separação com substituição autorizada → resumo → pagamento → confirmação → atendente
em qualquer etapa.

Comparado ao `main` (49ab47f), **o QuickCart já cobre a espinha e vai além**: endereço pelo CEP,
nome do perfil do WhatsApp, catálogo navegável, repetir compra, retirada, NFC-e, loja web, estoque,
fila de separação, notificação de status e fluxo editável. O roteiro não pede nada disso.

O que ele pede e nós não temos se concentra **depois da escolha do pagamento**, mais a taxa de
entrega e o atendente. Esta spec fecha essas lacunas, e só elas.

### 1.1 Divergências deliberadas — o roteiro NÃO será copiado nestes pontos

| Roteiro | Decisão | Por quê |
|---|---|---|
| Pedir o **nome completo** antes de tudo | Mantém o comportamento atual | O nome do perfil do WhatsApp já preenche a ficha. Perguntar na primeira mensagem é atrito para quem já disse quem é |
| Endereço digitado campo a campo | Mantém o CEP + ViaCEP | Menos digitação e endereço estruturado; o texto livre continua como queda |
| **Crédito** e **débito** como opções separadas | Mantém "Cartão na entrega" | O WhatsApp limita a **3 botões**, e a escolha é feita na maquininha. O que importa para a operação é o entregador levar a máquina (§3.2) |
| **Número do pedido** já no resumo | Número só na confirmação | O código nasce quando o pedido é criado, no "Confirmar". Criar o pedido antes mudaria o ciclo de vida inteiro por um rótulo |
| Lista única de status misturando conversa e pedido | Mantém a separação atual | `AGUARDANDO_LISTA` é etapa da conversa, não do pedido. Juntar os dois espalha estado de chat pela tabela de pedidos |

### 1.2 Fora de escopo (cada um vira spec própria)

- **Pix real** — chave/QR, comprovante, validação e status de pagamento. Envolve dinheiro,
  conferência de comprovante e possivelmente um PSP. Não cabe como item de uma spec de ajustes.
- **Encomendas** de açougue, padaria e assados. O próprio roteiro diz "próximos fluxos a serem
  estruturados". Precisa de definição com o mercado (data de retirada? sinal? peso aproximado?).
- **Taxa por faixa de distância.** Aqui a taxa é fixa e configurável; a faixa usa o modelo de
  distância que já existe (`.specs/features/delivery-distance`) e é regra de preço, não de fluxo.

## 2. Pré-requisito: substituição com autorização (roteiro §6)

A substituição com aceite do cliente **já está implementada** — ADR 0003, commits `ea356b2` e
`30fa0d2` — mas na branch `chore/notification-sdk-bump`, que está **sete commits à frente do main
e sem PR**. Ela também muda os status de pedido (`awaiting_customer_decision`, `in_transit`,
`arrived_at_customer`, `delivery_failed`).

Esta spec toca checkout, pedido e status. Construir por cima do `main` sem aquela branch gera
conflito certo nos mesmos arquivos. **A Fase 0 exige que ela esteja mergeada.** Mergear é decisão
humana: aquela branch tem trabalho não commitado de outra sessão no worktree principal.

## 3. Requisitos

### 3.1 Troco no dinheiro (roteiro §9)

- Ao escolher **Dinheiro**, o bot pergunta se precisa de troco: botões **"Não preciso"** e
  **"Preciso de troco"**.
- "Preciso de troco" pede o valor: "Troco para quanto? Ex.: se a compra deu R$ 132,50 e você vai
  pagar com R$ 150,00, responda 150".
- A leitura aceita `150`, `150,00`, `R$ 150`, `150.00`. Reaproveita a regra de separador decimal
  do `customers-ui` (`parseAttribute`): o ponto só é milhar quando há vírgula decimal.
- **O valor precisa ser maior que o total a pagar** (itens + taxa, §3.4). Igual ou menor é recusado
  com a mensagem "Esse valor não cobre a compra de R$ X" e a pergunta repetida — não aceita
  silenciosamente um troco impossível.
- Grava em `orders.cash_change_for_in_cents` (nulo = não precisa).
- Aparece: no resumo antes de confirmar, na confirmação final, no detalhe do pedido do painel e na
  tela do motorista.

### 3.2 Cartão na entrega — a maquininha (roteiro §11)

- Ao escolher **Cartão na entrega**, o bot confirma: "Certo! O pagamento é feito na entrega, no
  crédito ou débito — nosso entregador leva a maquininha."
- **Não há coluna nova**: `payment_method = card_on_delivery` já significa "levar a máquina". Uma
  função pura `requiresCardMachine(order)` é a única que decide isso; painel e motorista a consomem.
- Painel (detalhe do pedido) e tela do motorista mostram um selo **"Levar maquininha"**.
- Retirada na loja com cartão não mostra o selo (não há entrega).

### 3.3 Previsão de entrega para o cliente (roteiro §12)

- A confirmação final ganha a linha **"Previsão de entrega: entre X e Y minutos"**, usando o
  `ResolveOrderDeliveryEstimateUseCase` que hoje só alimenta o painel.
- **Nunca inventar**: sem `STORE_CEP`, sem coordenada do cliente, ou fora do raio, a linha **não
  aparece**. Uma previsão errada gera mais reclamação que previsão nenhuma.
- Retirada: "Pronto para retirada em cerca de N minutos", com `STORE_PREPARATION_MINUTES`.
- A previsão é calculada **depois** de criar o pedido e não pode atrasar nem derrubar a
  confirmação: falhou, a linha some e o erro vai para o log.

### 3.4 Taxa de entrega e resumo completo (roteiro §7)

**Taxa.**
- ⚠️ **Atualização (spec `taxa-por-faixa`):** a taxa deixou de ser fixa por env (`DELIVERY_FEE_CENTS`)
  e passa a ser **por faixa de distância**, editável no painel (`PUT /v1/admin/delivery-fee-tiers`).
  A taxa é cotada junto com o endereço (botão "Entrega") e snapshot no pedido.
- Coluna `orders.delivery_fee_in_cents` continua sendo `integer not null default 0`. Retirada = 0 sempre.
- **`total_in_cents` NÃO muda de significado** — continua sendo a soma dos itens. O valor cobrado do
  cliente é `total_in_cents + delivery_fee_in_cents`, e **uma única função** `amountDueInCents(order)`
  calcula isso. Nenhum outro lugar soma os dois.
- **Por que fora do total:** a NFC-e usa `totalInCents` como valor pago
  (`FiscalReceiptProvider.ts:84,140`) e **NFC-e não admite frete** (`modFrete = 9`). Somar a taxa ao
  total faria a nota ter pagamento maior que a soma dos itens e ser rejeitada. Como a taxa fica
  fora, a nota continua batendo.
- A reprecificação por item em falta (`NotifyUnavailableItems`) recalcula `total_in_cents` e **não
  pode zerar nem recalcular a taxa**.
- O pedido pela **loja web** (`CreateWebOrder`) recota a taxa (coordenação com a tarifa atual).

**Resumo antes de confirmar.** Passa a mostrar, nesta ordem:

```
Itens:
- 2x Arroz 5kg — R$ 49,80
- ...
Subtotal: R$ 132,50
Taxa de entrega: R$ 8,00        ← "grátis" quando 0; ausente na retirada
Total: R$ 140,50
Entrega: Rua X, 123 — Bairro (complemento)
Pagamento: Dinheiro — troco para R$ 150,00
Recibo: WhatsApp
```

**Alterar.** Os botões do resumo passam a ser **Confirmar / Alterar / Cancelar** (3, dentro do
limite). "Alterar" volta para a revisão do carrinho **mantendo** o contexto de checkout, e o
checkout lembrado (`rememberedCheckout`) oferece reaproveitar entrega e pagamento — refazer tudo
por causa de um item seria punir quem conferiu.

### 3.5 Atendente em qualquer etapa (roteiro, "Transferência para atendente")

- **Palavra-chave global**: `atendente`, `humano`, `pessoa`, `falar com atendente`,
  `falar com alguém` — normalizadas (minúsculas, sem acento, sem pontuação). Reconhecidas em
  **qualquer estado**, pelo `GlobalHandler`, com o mesmo efeito do botão "Falar com atendente" do
  menu.
- Casamento por **mensagem inteira ou frase curta**, não por substring: "o atendente anterior me
  mandou o produto errado" **não** dispara a transferência. Regra: após normalizar, a mensagem é
  uma das expressões, ou começa com "quero falar com" / "falar com" seguido de uma delas.
- A semântica atual de "pedir atendente" **não muda**: a conversa entra na fila "aguardando
  atendimento" e o bot continua respondendo até alguém assumir. Calar o bot deixaria o cliente sem
  resposta nenhuma quando não há atendente de plantão.
- **Painel:** a conversa mostra um bloco **"Pedido em andamento"** com o que o cliente já informou
  no checkout — itens do carrinho, entrega/retirada, endereço, pagamento, troco. É o requisito do
  roteiro de que o atendente "não precise solicitar novamente dados já coletados".

## 4. Critérios de aceite

1. Dinheiro com troco grava `cash_change_for_in_cents` e o valor aparece no resumo, na confirmação,
   no painel e na tela do motorista.
2. Troco menor ou igual ao total é recusado com a mensagem e a pergunta se repete.
3. Cartão na entrega mostra a mensagem da maquininha, e o selo aparece no painel e no motorista —
   nunca na retirada.
4. Com `STORE_CEP` configurado e cliente no raio, a confirmação traz a previsão; sem isso, a linha
   não aparece e nada falha.
5. Com `DELIVERY_FEE_CENTS=800`, o resumo mostra subtotal, taxa e total corretos; a NFC-e continua
   com o total dos itens; e marcar um item como em falta recalcula o subtotal sem mexer na taxa.
6. Com `DELIVERY_FEE_CENTS=0` (padrão), o resumo mostra "Taxa de entrega: grátis" e **nenhum**
   comportamento fiscal muda.
7. "Alterar" no resumo volta ao carrinho, e ao fechar de novo o checkout lembrado oferece a
   entrega e o pagamento já escolhidos.
8. "quero falar com atendente" em qualquer estado põe a conversa na fila; uma frase que só
   *menciona* "atendente" não põe.
9. O bloco "Pedido em andamento" do painel mostra o que o cliente já informou.
10. A suíte da api fica verde, com testes novos para cada item acima.

## 5. Riscos

| Risco | Mitigação |
|---|---|
| Conflito com a branch da substituição | Fase 0 bloqueia até ela estar no main |
| Taxa somada em algum lugar esquecido | `amountDueInCents` é a única soma; teste que falha se `total_in_cents` passar a incluir a taxa |
| Palavra-chave disparando em frase comum | Casamento por frase inteira + testes com frases que só mencionam "atendente" |
| `CheckoutHandler.ts` já tem ~490 linhas | Estados novos (troco) vão num handler/suporte próprio, não no mesmo arquivo |
| Painel de contexto depende do `@adatechnology/conversations-ui` | T3.2 investiga o ponto de extensão primeiro; se exigir mudança no pacote, **para e pergunta** |
