# ADR 0003 — Oferecer um substituto quando o item falta

Status: ✅ Aceita · 2026-08-16 · desenho anterior à implementação

## Contexto

Quando quem separa marca um item como em falta, o cliente recebe uma pergunta com dois botões:
seguir sem ele, ou cancelar o pedido. As duas respostas custam a venda daquele item — e na maior
parte das faltas de mercado existe, na prateleira ao lado, a mesma coisa de outra marca.

A proposta é oferecer esse parecido antes de perguntar se pode seguir sem. Recusar continua sendo
o caminho de hoje.

O desvio já existe como estado (`awaiting_customer_decision`), com cobrança agendada e retomada
pelo botão. O que este ADR decide é o que a pergunta passa a conter, e o que a resposta escreve.

## Evidência medida

| Peça | Como está hoje |
|---|---|
| Busca por semelhança | `DrizzleProductRepository.searchByTerm` já pontua com `similarity()` sobre `name`, `brand || ' ' || name` e cada elemento de `aliases`, e já filtra `is_available = true AND stock_quantity > 0` |
| Campos disponíveis | `products` tem `brand`, `unit`, `unit_size`, `aliases text[] NOT NULL DEFAULT '{}'`, `category_id NOT NULL`, `price_in_cents`, `stock_quantity` |
| Pergunta ao cliente | `buildOrderDecisionButtons` devolve **dois** botões, nunca três; teto de 20 caracteres por título, emoji incluído |
| Id do botão | `prefixo + orderId` (`parseOrderDecisionButtonId`), um único identificador por resposta |
| Escopo da pergunta | `buildCustomerDecisionMessage` monta **uma** pergunta para a lista inteira de faltas |
| Linha do pedido | `order_items` é snapshot (`product_name`, `unit_price_in_cents`); `unavailable_at` marca a falta **sem apagar a linha** |
| Baixa de estoque | `UPDATE ... stock_quantity - qty WHERE stock_quantity - qty >= 0`, dentro da transação do pedido |

Não medido: com que frequência existe substituto aceitável no catálogo real, e quantas faltas um
pedido costuma ter. Os dois números decidem se a funcionalidade vale o que custa, e nenhum dos
dois dá para responder sem produção.

## Decisão

1. **Pergunta por item, uma de cada vez, com teto.** Até 3 faltas, uma pergunta por item, na
   ordem da lista, a seguinte só depois da resposta anterior. Acima disso, cai na pergunta única
   de hoje, sem substituto.

   *Revisado em 23/09/2026*: "uma de cada vez" valia para as faltas de um mesmo recado, mas não para
   a loja. `AWAITING_CUSTOMER_DECISION` estava entre os estados de onde se podia entrar no desvio, e
   com ele um segundo clique em "Avisar e aguardar aprovação" mandava uma segunda pergunta com a
   primeira ainda sem resposta. Na oferta de troca o id ainda diria de qual item se trata; na
   pergunta do pedido inteiro ele carrega só o `orderId`, e aí as duas respostas são a mesma string.
   O estado saiu da lista: com pergunta em aberto, a falta nova fica sem carimbo e vira a próxima
   pergunta quando a resposta chegar — que é o mesmo caminho da falta seguinte de um recado só.
   `NotifyUnavailableItems` devolve `outcome: 'queued'`, e a tela troca o botão pela frase.

   Informar e seguir (sem aprovação) continua liberado no desvio: é recado sem botão, não há resposta
   que possa se confundir com outra, e é a saída de quem precisa avisar antes de a resposta chegar.
2. **Só pergunta com candidato aprovado.** Sem candidato, o item vai direto para a pergunta atual.
3. **O candidato sai de `searchByTerm`, restringido**: mesma `category_id`, `id` diferente do que
   faltou, **mesmo `unit` e mesmo `unit_size`**, até `MAX_SUBSTITUTE_CANDIDATES` (4), por score.
4. **Um parecido vira botões, vários viram lista.** Com um só: `🔄 Trocar` / `➡️ Sem ele` /
   `❌ Cancelar`. Com dois ou mais: mensagem de lista com um parecido por linha, mais `➡️ Sem ele`
   e `❌ Cancelar` — três botões não cabem quatro marcas. Os parecidos aparecem no corpo com preço
   e diferença, e os ids das linhas são os mesmos dos botões, lidos pelo mesmo parser.

8. **A resposta sobre item em falta não passa pelo grafo de fluxo**, em nenhum estado: o webhook
   reconhece o id e entrega direto à engine, onde o `GlobalHandler` a atende.

   *Revisado em 23/09/2026*: a versão original oferecia um único parecido, o de maior score. Quem
   pediu açúcar refinado e recebeu só a marca mais parecida desistia da troca em vez de aceitar
   outra marca que a loja tinha na prateleira.

   *Revisado em 23/09/2026 (item 8)*: a oferta pode ficar horas sem resposta, e nesse meio-tempo a
   sessão expira para `greeting`. Como o grafo tem a primeira palavra, o toque em "🔄 Trocar" virava
   resposta ao nó de saudação — o cliente aceitava a troca e recebia "Oi de novo!", sem o item entrar
   na sacola.
5. **Aceitar cria linha nova em `order_items`**, com `substitutes_order_item_id` apontando para a
   linha que faltou. A linha original permanece marcada como indisponível.
6. **O aceite baixa o estoque do substituto pelo mesmo `UPDATE` condicional, em transação com a
   inserção da linha e o recálculo do total.** Estoque insuficiente na hora do aceite não é erro:
   vira "seguimos sem o item", e o cliente é avisado.
7. **A troca é registrada como trilha**: pedido, item de origem, produto de destino, diferença em
   centavos e instante do aceite.

## Razões, na ordem em que pesam

**1. Uma pergunta por vez porque duas perguntas no WhatsApp viram uma resposta.** É a mesma regra
que já vale para o corpo da mensagem (`conversation-flow.md` §5): duas perguntas juntas produzem
resposta para uma delas — e aqui a que ficar sem resposta é um item que ninguém sabe se entra na
sacola. O teto de 3 existe porque um pedido com cinco faltas não tem problema de item, tem
problema de pedido, e a conversa certa ali é a global.

**2. Não perguntar sem candidato é o que impede a funcionalidade de piorar a conversa.** "Faltou
arroz, quer trocar por feijão?" gasta um turno, confunde e faz o cliente desconfiar do resto.
A ausência de candidato é resposta legítima, e o fluxo de hoje já a atende.

**3. `unit` e `unit_size` iguais, sem exceção.** Leite 1L por leite 2L não é substituição: é
outra compra, com outro preço e outra intenção. O `similarity()` não sabe disso — os nomes são
quase idênticos — então a trava é do `WHERE`, não do score.

**4. Três botões cabem, e o nome do produto não.** O teto de 20 caracteres por título já obrigou
"🛒 Nova lista" a ser o que é; "Piracanjuba Integral 1L" tem 23 sem emoji. O corpo não tem esse
teto e é onde preço e diferença precisam estar de qualquer forma — trocar por algo mais caro sem
dizer quanto é cobrar sem avisar.

**5. Linha nova, e não linha reescrita, pelo mesmo motivo de `unavailable_at`.** Sobrescrever
`product_name` e `unit_price_in_cents` apagaria que o cliente pediu outra coisa — que é o dado
mais valioso do episódio, tanto para explicar a sacola na porta quanto para a loja descobrir o
que falta sempre. É a decisão que já tomamos em `order_delivery_attempts`: o fato fica, não é
sobrescrito.

**6. O aceite é consentimento sobre o preço.** O cliente aprovou um total; a troca muda esse
total. Por isso o registro tem que ter a diferença e o instante — é trilha de auditoria
(`security.md` §10), e é o que responde "por que esse pedido custou R$ 0,30 a mais".

**7. Falha de estoque no aceite não pode deixar o pedido sem nenhum dos dois.** Entre a oferta e
o toque do cliente passam minutos, e o substituto pode ter sido separado para outro pedido. O
`UPDATE` condicional já devolve isso sem corrida; o que o fluxo precisa é tratar a devolução
vazia como o desfecho "segue sem o item", não como erro.

## Limite desta decisão

- **Um substituto, nunca uma lista.** Escolher entre três marcas é trabalho que a loja está
  empurrando para quem só queria comprar leite. Se a recusa se mostrar alta, a segunda oferta é
  candidata a existir — mas com número medido, não por suposição.
- Não cobre substituição decidida pela loja sem perguntar, que é outra política e outro risco.
- Não cobre substituto de outra categoria, mesmo quando o cliente aceitaria (manteiga por
  margarina). Depende de um mapa de equivalência que não existe, e o `category_id` sozinho não o
  representa.
- O id do botão passa a carregar três identificadores (pedido, item, produto). O contrato de
  `parseOrderDecisionButtonId` muda junto, e os dois lados vivem no mesmo arquivo justamente para
  não divergirem — a mudança respeita isso ou não deve ser feita.
- Não decide o texto final das mensagens, que é passo de implementação e vale ser lido em voz
  alta antes de subir.
