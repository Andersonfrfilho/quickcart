/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { and, eq } from 'drizzle-orm'
import { db } from '@/infra/database/connection'
import { carts, cartItems, type Cart, type CartItem } from '@/infra/database/schema'
import { CART_STATUS } from '@/modules/cart/shared/Cart.constant'
import type {
  AddCartItemRecordParams,
  CartItemRecord,
  CartRecord,
  CartRepositoryInterface,
  CreateCartRecordParams,
} from '@/modules/cart/domain/CartRepository.interface'

function toCartItemRecord(row: CartItem): CartItemRecord {
  return {
    id: row.id,
    cartId: row.cartId,
    productId: row.productId,
    quantity: Number(row.quantity),
    matchType: row.matchType,
    originalTerm: row.originalTerm,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class DrizzleCartRepository implements CartRepositoryInterface {
  async findOpenByCustomer(customerId: string, channel: string): Promise<CartRecord | undefined> {
    const [cart] = await db
      .select()
      .from(carts)
      .where(and(eq(carts.customerId, customerId), eq(carts.channel, channel), eq(carts.status, CART_STATUS.OPEN)))
      .limit(1)

    return cart as Cart | undefined
  }

  async create(params: CreateCartRecordParams): Promise<CartRecord> {
    const [cart] = await db
      .insert(carts)
      .values({ id: params.id, customerId: params.customerId, channel: params.channel, status: CART_STATUS.OPEN })
      .returning()

    return cart as Cart
  }

  async findById(id: string): Promise<CartRecord | undefined> {
    const [cart] = await db.select().from(carts).where(eq(carts.id, id)).limit(1)
    return cart
  }

  async updateStatus(id: string, status: string): Promise<CartRecord | undefined> {
    const [cart] = await db.update(carts).set({ status, updatedAt: new Date() }).where(eq(carts.id, id)).returning()
    return cart
  }

  async listItems(cartId: string): Promise<CartItemRecord[]> {
    const rows = await db.select().from(cartItems).where(eq(cartItems.cartId, cartId))
    return rows.map(toCartItemRecord)
  }

  async findItemByProduct(cartId: string, productId: string): Promise<CartItemRecord | undefined> {
    const [row] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)))
      .limit(1)

    return row ? toCartItemRecord(row) : undefined
  }

  async findItemById(id: string): Promise<CartItemRecord | undefined> {
    const [row] = await db.select().from(cartItems).where(eq(cartItems.id, id)).limit(1)
    return row ? toCartItemRecord(row) : undefined
  }

  async addItem(params: AddCartItemRecordParams): Promise<CartItemRecord> {
    const [row] = await db
      .insert(cartItems)
      .values({
        id: params.id,
        cartId: params.cartId,
        productId: params.productId,
        quantity: String(params.quantity),
        matchType: params.matchType,
        originalTerm: params.originalTerm ?? null,
      })
      .returning()

    return toCartItemRecord(row as CartItem)
  }

  async updateItemQuantity(id: string, quantity: number): Promise<CartItemRecord | undefined> {
    const [row] = await db
      .update(cartItems)
      .set({ quantity: String(quantity), updatedAt: new Date() })
      .where(eq(cartItems.id, id))
      .returning()

    return row ? toCartItemRecord(row) : undefined
  }

  async removeItem(id: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.id, id))
  }
}
