/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * quantity é exposta como number nesta camada — a implementação Drizzle converte
 * de/para string no limite do banco (coluna numeric).
 */

export type CartRecord = {
  readonly id: string
  readonly customerId: string
  readonly channel: string
  readonly status: string
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type CartItemRecord = {
  readonly id: string
  readonly cartId: string
  readonly productId: string
  readonly quantity: number
  readonly matchType: string
  readonly originalTerm: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type CreateCartRecordParams = {
  readonly id: string
  readonly customerId: string
  readonly channel: string
}

export type AddCartItemRecordParams = {
  readonly id: string
  readonly cartId: string
  readonly productId: string
  readonly quantity: number
  readonly matchType: string
  readonly originalTerm?: string | undefined
}

export interface CartRepositoryInterface {
  findOpenByCustomer(customerId: string, channel: string): Promise<CartRecord | undefined>
  create(params: CreateCartRecordParams): Promise<CartRecord>
  findById(id: string): Promise<CartRecord | undefined>
  updateStatus(id: string, status: string): Promise<CartRecord | undefined>
  listItems(cartId: string): Promise<CartItemRecord[]>
  findItemByProduct(cartId: string, productId: string): Promise<CartItemRecord | undefined>
  findItemById(id: string): Promise<CartItemRecord | undefined>
  addItem(params: AddCartItemRecordParams): Promise<CartItemRecord>
  updateItemQuantity(id: string, quantity: number): Promise<CartItemRecord | undefined>
  removeItem(id: string): Promise<void>
}
