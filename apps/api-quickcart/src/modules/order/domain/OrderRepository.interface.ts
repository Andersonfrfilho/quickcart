/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

export type OrderRecord = {
  readonly id: string
  readonly shortCode: string
  readonly customerId: string
  readonly cartId: string | null
  readonly channel: string
  readonly status: string
  readonly totalInCents: number
  readonly deliveryType: string
  readonly address: unknown
  /**
   * O texto original de pedidos antigos, preservado quando o backfill (Fase 4) não conseguiu
   * extrair CEP do texto livre. `null` em todo pedido criado antes da migração ou depois que o
   * endereço já nasce estruturado — não é "backfill ainda não rodou", é "não havia nada a preservar".
   */
  readonly legacyAddressText: string | null
  readonly paymentMethod: string
  readonly receiptPreference: string
  readonly fiscalDocumentId: string | null
  readonly notes: string | null
  /**
   * Por que a entrega não aconteceu. Preenchido só com `status = delivery_failed`.
   *
   * É ele, e não o status, que diz se ainda cabe outra tentativa — cliente ausente recebe amanhã,
   * cliente que recusou a sacola não recebe de novo.
   */
  readonly deliveryFailureReason: string | null
  /** Quando a pergunta sobre os itens em falta saiu. `null` = nunca perguntamos. */
  readonly customerDecisionAskedAt: Date | null
  /** Quando a pergunta foi cobrada — uma vez só. `null` com `askedAt` preenchido = ainda dá para cobrar. */
  readonly customerDecisionRemindedAt: Date | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type OrderItemRecord = {
  readonly id: string
  readonly orderId: string
  readonly productId: string
  readonly productName: string
  readonly unitPriceInCents: number
  readonly quantity: number
  readonly totalInCents: number
  /** `null` = nada de anormal. Preenchido quando a loja não achou o item na hora de separar. */
  readonly unavailableAt: Date | null
  /** `null` com `unavailableAt` preenchido = falta registrada e cliente ainda não avisado. */
  readonly unavailableNotifiedAt: Date | null
  /** Quando foi separado. `null` = ainda não. Vem do servidor, não do aparelho de quem separa. */
  readonly pickedAt: Date | null
  /**
   * A linha que esta substitui. `null` na linha que o cliente pediu — que é a esmagadora maioria.
   *
   * Preenchido só na linha nascida de uma troca aceita: com ela e a origem, a troca inteira está
   * descrita, inclusive a diferença de preço (a subtração dos dois `totalInCents`).
   */
  readonly substitutesOrderItemId: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type CreateOrderItemInput = {
  readonly productId: string
  readonly productName: string
  readonly unitPriceInCents: number
  readonly quantity: number
  readonly totalInCents: number
}

export type CreateOrderWithItemsParams = {
  readonly id: string
  readonly customerId: string
  readonly cartId?: string | undefined
  readonly channel: string
  readonly deliveryType: string
  readonly address?: unknown
  readonly paymentMethod: string
  readonly receiptPreference: string
  readonly notes?: string | undefined
  readonly items: ReadonlyArray<CreateOrderItemInput>
}

export type InsufficientStockItem = {
  readonly productId: string
  readonly requested: number
  readonly available: number
}

export type CreateOrderWithItemsResult =
  | { readonly ok: true; readonly order: OrderRecord; readonly items: OrderItemRecord[] }
  | { readonly ok: false; readonly insufficientItems: InsufficientStockItem[] }

export type ListOrdersRepositoryParams = {
  readonly status?: readonly string[] | undefined
  /** Nome, telefone ou código do pedido. Casa parcialmente e sem diferenciar maiúscula. */
  readonly search?: string | undefined
  readonly deliveryType?: readonly string[] | undefined
  readonly paymentMethod?: readonly string[] | undefined
  readonly page: number
  readonly perPage: number
  readonly sortBy: 'createdAt' | 'totalInCents' | 'status'
  readonly sortDirection: 'asc' | 'desc'
}

/**
 * Pedido com quem pediu, para a listagem da loja.
 *
 * O nome vem junto na mesma consulta, e não numa busca por pedido: uma tela de quinze pedidos faria
 * quinze idas ao banco para escrever quinze nomes. E sem nome a lista obriga o operador a decorar
 * telefone — o pedido é de uma pessoa, não de um número.
 */
export type OrderWithCustomer = OrderRecord & {
  /** `null` quando o cliente ainda não se apresentou ao bot; a tela cai para o telefone. */
  readonly customerName: string | null
  readonly customerPhone: string
}

export type ListOrdersRepositoryResult = {
  readonly items: OrderWithCustomer[]
  readonly total: number
}

/**
 * O item do pedido acrescido do que o CATÁLOGO sabe do produto hoje.
 *
 * Vem do catálogo, e não do snapshot da linha, porque nada disto é dinheiro: foto, embalagem e corredor
 * servem para achar o produto na prateleira agora, então a versão útil é a atual — se o mercado mudou o
 * café de corredor ontem, quem separa hoje precisa do corredor de hoje. Nome e preço continuam
 * congelados na linha, que é o que o cliente contratou.
 *
 * Tudo opcional: produto sem foto, sem marca ou sem corredor mapeado é o caso comum, e a tela decide por
 * presença — nunca preenche com "—", que quem separa leria como informação.
 */
export type OrderDetailItem = OrderItemRecord & {
  readonly productImageUrl: string | null
  readonly productBrand: string | null
  readonly productUnitSize: string | null
  readonly productAisle: string | null
}

/**
 * Uma viagem da sacola, encerrada ou em andamento.
 *
 * `endedAt: null` é a viagem de agora. `outcome` só é nulo junto com ela — desfecho é o que encerra.
 */
export type OrderDeliveryAttemptRecord = {
  readonly attempt: number
  readonly startedAt: Date
  readonly endedAt: Date | null
  readonly outcome: string | null
  readonly failureReason: string | null
}

/** Pedido aberto: itens e quem pediu, para a loja saber o que separar e para quem. */
export type OrderDetail = {
  readonly order: OrderWithCustomer
  readonly items: OrderDetailItem[]
  /**
   * Vazio numa retirada e num pedido que ainda não saiu — nos dois casos porque não houve viagem, e é
   * a mesma resposta honesta. A tela decide o que dizer sobre isso; o repositório não inventa uma
   * tentativa zero para diferenciar.
   */
  readonly deliveryAttempts: OrderDeliveryAttemptRecord[]
}

/**
 * O que aconteceu com a troca. Três desfechos, e cada um vira um texto diferente para o cliente.
 *
 * `out_of_stock` não é erro: entre a oferta e o toque passam minutos, e o substituto pode ter sido
 * separado para outro pedido. O desfecho certo ali é "seguimos sem o item" — nunca uma mensagem de falha.
 */
export type SubstituteItemResult =
  | { readonly ok: true; readonly detail: OrderDetail }
  | { readonly ok: false; readonly reason: 'out_of_stock' | 'not_substitutable' }

export interface OrderRepositoryInterface {
  createWithStockDecrement(params: CreateOrderWithItemsParams): Promise<CreateOrderWithItemsResult>
  findById(id: string): Promise<OrderRecord | undefined>
  findByShortCode(shortCode: string): Promise<OrderRecord | undefined>
  findLastByCustomer(customerId: string): Promise<OrderRecord | undefined>
  /**
   * Últimas compras DAQUELE cliente, para ele mesmo ver no WhatsApp.
   *
   * Separado do `list` paginado de propósito: aquele é da área administrativa e não filtra por
   * cliente, então usá-lo aqui mostraria pedido de outra pessoa a quem só pediu o próprio histórico.
   * O limite é do chamador porque lista do WhatsApp cabe 10 linhas, não porque o banco se importe.
   */
  listRecentByCustomer(customerId: string, limit: number): Promise<OrderRecord[]>
  listItems(orderId: string): Promise<OrderItemRecord[]>
  list(params: ListOrdersRepositoryParams): Promise<ListOrdersRepositoryResult>
  findDetailById(id: string): Promise<OrderDetail | undefined>
  /**
   * Marca (ou desmarca) um item como em falta e devolve o pedido com o total recalculado.
   *
   * Total no mesmo passo, e não em duas chamadas: item em falta que não sai da conta faz o cliente
   * pagar pelo que não recebeu, e um instante com a conta errada gravada é um instante em que alguém
   * pode ler, cobrar ou fechar o caixa.
   */
  /**
   * Marca como avisados os itens em falta que ainda não foram, e devolve quais eram.
   *
   * Devolve a lista porque quem chama precisa montar a mensagem com exatamente esses itens — reler depois
   * de marcar traria zero, e reler antes abriria janela para marcar um item que não entrou no recado.
   */
  markUnavailableItemsNotified(orderId: string): Promise<OrderItemRecord[]>
  /**
   * Carimba UM item como avisado.
   *
   * Existe por causa da pergunta por item (ADR 0003): marcar a lista inteira daria por avisado o item
   * cuja pergunta ainda nem saiu — e o cliente nunca a receberia, porque "avisado" é o que a exclui.
   */
  markItemUnavailableNotified(params: {
    readonly orderId: string
    readonly itemId: string
  }): Promise<OrderItemRecord | undefined>
  setItemUnavailable(params: {
    readonly orderId: string
    readonly itemId: string
    readonly unavailable: boolean
  }): Promise<OrderDetail | undefined>
  /**
   * Marca (ou desmarca) um item como separado.
   *
   * Não recalcula total: separar não muda o que o cliente paga — quem muda é a falta. Devolve o detalhe
   * inteiro porque a tela precisa do progresso recontado, e recontar no cliente abriria a chance de duas
   * verdades sobre o mesmo pedido.
   */
  setItemPicked(params: {
    readonly orderId: string
    readonly itemId: string
    readonly picked: boolean
  }): Promise<OrderDetail | undefined>
  /**
   * Marca ou limpa todos de uma vez, em uma ida ao banco.
   *
   * "Marcar todos" numa compra de mês seriam trinta requisições, e trinta chances de metade ficar
   * marcada se a rede cair no meio. Item em falta fica de fora ao marcar: não se separa o que não existe.
   */
  setAllItemsPicked(params: { readonly orderId: string; readonly picked: boolean }): Promise<OrderDetail | undefined>
  /**
   * Muda o status, opcionalmente só se o atual for `expectedCurrentStatus`.
   *
   * A checagem vai para o `WHERE` porque validar em memória e gravar depois deixa uma janela entre as duas
   * coisas: dois cliques (ou duas pessoas) leem o mesmo estado, os dois passam pela validação e o segundo
   * sobrescreve o primeiro — cada um disparando uma mensagem ao cliente. Devolve `undefined` quando nada
   * casou, e aí quem chamou sabe que alguém chegou antes.
   */
  updateStatus(params: {
    readonly orderId: string
    readonly status: string
    readonly expectedCurrentStatus?: string | undefined
    /**
     * O motivo da ocorrência, gravado na MESMA escrita do status.
     *
     * `null` limpa: o pedido que sai da ocorrência para outra tentativa não pode carregar o motivo da
     * viagem anterior — a tela mostraria "cliente ausente" num pedido que está de novo na rua. Em duas
     * escritas separadas haveria um instante com status e motivo se contradizendo.
     */
    readonly deliveryFailureReason?: string | null | undefined
  }): Promise<OrderRecord | undefined>
  /**
   * Põe o pedido em espera da decisão do cliente e carimba quando a pergunta saiu, numa escrita só.
   *
   * Status e carimbo juntos porque são o mesmo fato: um pedido "aguardando" sem hora da pergunta não
   * responde "há quanto tempo essa pessoa está sendo esperada", que é justamente o que decide se alguém
   * liga. E `remindedAt` volta a `null` porque a cobrança é uma por pergunta, não uma por pedido —
   * segunda falta no mesmo pedido é uma pergunta nova.
   *
   * `allowedCurrentStatuses` vai para o `WHERE` pela mesma razão do `updateStatus`: validar em memória e
   * gravar depois deixa a janela em que outra pessoa mudou o pedido no meio. `undefined` = não casou.
   */
  startCustomerDecision(params: {
    readonly orderId: string
    readonly allowedCurrentStatuses: readonly string[]
  }): Promise<OrderRecord | undefined>
  /**
   * Troca um item em falta pelo substituto que o cliente aceitou, numa transação só.
   *
   * Baixa de estoque, linha nova e total recalculado juntos: em escritas separadas existiria um instante
   * com a linha inserida e o estoque intacto — o próximo pedido compraria o que já foi para esta sacola.
   *
   * A origem continua marcada como em falta e fora da conta; é ela que conta que o cliente pediu outra coisa.
   */
  substituteItem(params: {
    readonly orderId: string
    readonly orderItemId: string
    readonly productId: string
  }): Promise<SubstituteItemResult>
  /** Carimba a cobrança única. Só casa se ainda não houver carimbo — dois workers não cobram duas vezes. */
  markCustomerDecisionReminded(orderId: string): Promise<OrderRecord | undefined>
  /**
   * Cancela e, quando pedido, devolve os itens ao estoque na mesma transação.
   *
   * `restoreStock` existe por causa do extraviado: a sacola não voltou para a loja, e repor ali criaria
   * estoque de um produto que ninguém tem para separar — o próximo cliente compraria o que não existe.
   * Quem decide é a regra de domínio; o repositório só executa as duas coisas juntas ou nenhuma.
   */
  cancel(params: { readonly orderId: string; readonly restoreStock: boolean }): Promise<OrderRecord | undefined>
}
