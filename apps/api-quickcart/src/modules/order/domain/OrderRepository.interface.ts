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

/** Pedido aberto: itens e quem pediu, para a loja saber o que separar e para quem. */
export type OrderDetail = {
  readonly order: OrderWithCustomer
  readonly items: OrderItemRecord[]
}

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
  updateStatus(id: string, status: string, expectedCurrentStatus?: string): Promise<OrderRecord | undefined>
  cancelAndRestoreStock(id: string): Promise<OrderRecord | undefined>
}
