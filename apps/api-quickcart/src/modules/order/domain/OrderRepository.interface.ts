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
  readonly page: number
  readonly perPage: number
  readonly sortBy: 'createdAt' | 'totalInCents' | 'status'
  readonly sortDirection: 'asc' | 'desc'
}

export type ListOrdersRepositoryResult = {
  readonly items: OrderRecord[]
  readonly total: number
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
  updateStatus(id: string, status: string): Promise<OrderRecord | undefined>
  cancelAndRestoreStock(id: string): Promise<OrderRecord | undefined>
}
