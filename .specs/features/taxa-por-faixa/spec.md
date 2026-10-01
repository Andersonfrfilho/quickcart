# Spec — Taxa de entrega por faixa de distância

Criado em 2026-09-22 · Desenho validado por `architect` (opus) em [`design.md`](./design.md).

## 1. Contexto

A spec `roteiro-atendimento` (#26) criou uma taxa de entrega **fixa** (`DELIVERY_FEE_CENTS`, hoje 0).
O usuário decidiu trocá-la por **faixas de distância editáveis no painel** — ex.: até 3 km R$ 5,00, até
8 km R$ 10,00. Fora da última faixa, a loja não entrega.

A regra fiscal não muda: a taxa fica **fora do `total_in_cents`** (a NFC-e usa o total como valor pago e
não admite frete) e `amountDueInCents` continua sendo a única soma.

**A mudança de fundo:** a taxa deixa de ser função do **tipo de entrega** e passa a ser função do
**endereço** — e o endereço só existe num passo posterior do fluxo. Todo o desenho desloca o ponto de
cotação para depois do endereço e concentra o cálculo num único use case.

## 2. Decisões do usuário (2026-09-22)

| # | Decisão |
|---|---|
| D1 | Taxa por faixa, editável no painel. Substitui `DELIVERY_FEE_CENTS`. |
| D2 | **Localização do cliente por CEP digitado OU pela localização enviada pelo WhatsApp.** A localização dá a coordenada exata. |
| D3 | CEP que só localiza a cidade (centro do município, CEP genérico) → **cobra a maior faixa**. |
| D4 | Staging começa com **3 km R$ 5,00 / 8 km R$ 10,00**. |
| D5 | Limites do painel: até **10 faixas**, até **50 km**, taxa **zero permitida**. |
| D6 | Falha de geocodificação (sem coordenada nenhuma) → **não entrega naquele momento**: oferece retirada ou outro endereço. (Recomendação do architect, não contestada.) |

⚠️ **Fiscal:** com faixa acima de zero, o cliente paga itens + taxa e a NFC-e registra só os itens. O
usuário já foi alertado; este projeto roda só em staging. **Antes de produção, resposta do contador.**

## 3. Requisitos

### 3.1 Faixas

- Tabela `delivery_fee_tiers`: `max_distance_km` (> 0, único) e `fee_in_cents` (>= 0). Formato "até X km":
  a faixa i cobre (X[i-1], X[i]], a primeira começa em 0 — sobreposição e buraco são impossíveis.
- O painel substitui **a lista inteira** numa transação (`PUT`). Validação da lista: 1–10 faixas,
  `maxDistanceKm` de 0,1 a 50 com até 2 casas, **estritamente crescente**; `feeInCents` inteiro 0–100000.
  A taxa **não precisa crescer** com a distância. Todos os erros de uma vez.
- **Sem faixa configurada, não há entrega** (fail-closed): só retirada.
- Seed de boot idempotente: tabela vazia → cria as faixas de D4. Não sobrescreve faixa existente.
- `STORE_CEP` passa a ser obrigatório para existir entrega; sem ele, só retirada, com `warn` no boot.
- `DELIVERY_FEE_CENTS` e `STORE_DELIVERY_RADIUS_KM` saem. O raio passa a ser o fim da última faixa.

### 3.2 Localização do cliente

Três fontes, em ordem de precisão:

| Fonte | Como | Precisão |
|---|---|---|
| **Localização do WhatsApp** | mensagem `type: location` (lat/lng) | exata |
| **CEP** digitado | ViaCEP + geocodificação com cache | exata, ou **aproximada** (centro da cidade) |
| Texto livre sem CEP | — | **não serve para entrega**: o bot pede CEP ou localização |

- A localização exige o pacote `@adatechnology/meta-whatsapp-module` com suporte a mensagem de
  localização (PR no repositório de pacotes). **Fase 0** confere que ele está publicado.
- Com localização, o bot ainda pede **número e complemento/referência** para o entregador.
- Coordenada é dado pessoal: nunca em log.

### 3.3 Cotação

Use case único `QuoteDeliveryFee` — entrada `{ deliveryType, location }`, saída:

| kind | quando |
|---|---|
| `pickup` | retirada — taxa 0 |
| `quoted` | dentro de uma faixa — taxa, distância, faixa aplicada |
| `approximate_max_tier` | coordenada só da cidade (D3) — **maior faixa** |
| `out_of_range` | além da última faixa |
| `unavailable` | sem `STORE_CEP`, sem faixas, ou sem coordenada nenhuma (D6) |

É consumido por **quatro** lugares — bot, cotação web pública, `CreateWebOrder`, `CreateOrderFromCart` —
e ninguém mais calcula taxa. `ResolveOrderDeliveryEstimate` passa a usar a mesma função de distância.

### 3.4 WhatsApp

- A cotação sai do clique em "Entrega" e passa para **quando o endereço fica pronto**. O cliente vê
  "Taxa de entrega para seu endereço (X km): R$ Y" **antes** de escolher o pagamento.
- Retirada: taxa 0 direto.
- Fora do raio: estado novo `AWAITING_OUT_OF_RANGE_DECISION` — "Seu endereço fica a ~X km e entregamos
  até N km", botões **Retirar na loja** / **Outro endereço**.
- `unavailable`: mesma escolha, com a mensagem do motivo ("não consegui calcular a distância").
- "Isso mesmo" (checkout lembrado): entrega lembrada é **recotada** com a localização lembrada (a faixa
  pode ter mudado); se não der, cai no caminho longo.
- "Alterar": apaga a cotação do contexto (`withoutDeliveryQuote`) — taxa velha não sobrevive a endereço
  novo.
- `confirmOrder` usa a cotação **do contexto** (o troco foi validado contra ela); não recalcula.
- Sessão antiga sem cotação no contexto: `enterConfirming` cota na hora; se não conseguir, volta ao
  endereço. O fallback de env some.

### 3.5 Checkout web

- A cotação pública recebe `cep` (obrigatório para entrega) e devolve a cotação ou o motivo.
- `CreateWebOrder` **recota** (não confia no navegador): taxa mudou → 409 `DELIVERY_FEE_CHANGED` e a tela
  recota; fora do raio → 422 `DELIVERY_OUT_OF_RANGE`.
- A rota pública passa a poder disparar geocodificação: **cache negativo** (CEP que falhou não é tentado
  de novo por 24 h), **1 chamada/s** ao provedor, coordenada da loja em memória. Rate limit por IP já
  existe.

### 3.6 Painel

- Tela `/admin/delivery-fees` (só admin): tabela editável "Até (km)" / "Taxa (R$)", aviso "Fora de N km
  a loja não entrega", Salvar com a lista inteira. Trilha de auditoria: ator, lista antiga e nova.
- Detalhe do pedido e card da conversa mostram "Faixa até N km · X km" (com "aprox." no caso D3).

### 3.7 Pedido guarda a cotação

Snapshot, sem FK (a faixa é substituída a cada PUT): `delivery_distance_km`, `delivery_tier_max_km`,
`delivery_tier_fee_in_cents`, e `delivery_location_source` (`whatsapp_location` | `cep` |
`cep_approximate`). Nullable — retirada e pedidos antigos ficam nulos. O worker espelha as colunas; o
recibo simples mostra "Entrega (até N km)".

## 4. Critérios de aceite

1. Com as faixas de D4, um CEP a 2 km cobra R$ 5,00; a 6 km, R$ 10,00; a 12 km, fora do raio.
2. A localização enviada pelo WhatsApp cota pela coordenada exata, sem pedir CEP.
3. CEP aproximado (centro da cidade) cobra a maior faixa, e o pedido registra `cep_approximate`.
4. Sem coordenada nenhuma, o bot não aceita entrega e oferece retirada ou outro endereço.
5. O cliente vê a taxa antes de escolher o pagamento; o troco é validado contra itens + essa taxa.
6. "Isso mesmo" recota com a faixa atual; "Alterar" apaga a cotação antiga.
7. Web: taxa aparece com o CEP; mudou entre cotação e pedido → 409 e recota; fora do raio → 422.
8. O pedido guarda distância, faixa e fonte; o painel mostra.
9. Painel edita as faixas (só admin) com validação da lista inteira; lista vazia desliga entrega.
10. Nenhuma coordenada, CEP ou endereço em log. NFC-e continua só com os itens.
11. Suítes verdes nos três apps, com teste para cada item acima.

## 5. Fora de escopo

- Edição de endereço de pedido já criado (não existe hoje).
- Taxa por horário, por valor mínimo de compra ou frete grátis acima de X.
