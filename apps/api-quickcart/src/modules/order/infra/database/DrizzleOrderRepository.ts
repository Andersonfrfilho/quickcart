/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O decremento de estoque roda dentro da mesma transação que cria o pedido (spec §2):
 * cada item tenta um UPDATE com guarda `stock_quantity - qty >= 0` (mesmo padrão atômico
 * do `DrizzleProductRepository.adjustStock`, mas via `tx` para participar da transação).
 * Falha em qualquer item lança um sinal interno que aborta a transação inteira antes de
 * o pedido/itens serem persistidos — nenhuma escrita parcial sobrevive.
 */

import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { db } from '@/infra/database/connection'
import { orders, orderItems, products, type Order, type OrderItem } from '@/infra/database/schema'
import { generateId } from '@/shared/id'
import { ORDER_STATUS } from '@/modules/order/shared/Order.constant'
import type {
  CreateOrderWithItemsParams,
  CreateOrderWithItemsResult,
  InsufficientStockItem,
  ListOrdersRepositoryParams,
  ListOrdersRepositoryResult,
  OrderItemRecord,
  OrderRecord,
  OrderRepositoryInterface,
} from '@/modules/order/domain/OrderRepository.interface'

const SORTABLE_COLUMNS = {
  createdAt: orders.createdAt,
  totalInCents: orders.totalInCents,
  status: orders.status,
} as const

class InsufficientStockSignal extends Error {
  constructor(public readonly items: InsufficientStockItem[]) {
    super('insufficient_stock')
  }
}

function toOrderRecord(order: Order): OrderRecord {
  return {
    id: order.id,
    shortCode: order.shortCode,
    customerId: order.customerId,
    cartId: order.cartId,
    channel: order.channel,
    status: order.status,
    totalInCents: order.totalInCents,
    deliveryType: order.deliveryType,
    address: order.address,
    paymentMethod: order.paymentMethod,
    receiptPreference: order.receiptPreference,
    fiscalDocumentId: order.fiscalDocumentId,
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }
}

function toOrderItemRecord(item: OrderItem): OrderItemRecord {
  return {
    id: item.id,
    orderId: item.orderId,
    productId: item.productId,
    productName: item.productName,
    unitPriceInCents: item.unitPriceInCents,
    quantity: Number(item.quantity),
    totalInCents: item.totalInCents,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

export class DrizzleOrderRepository implements OrderRepositoryInterface {
  async createWithStockDecrement(params: CreateOrderWithItemsParams): Promise<CreateOrderWithItemsResult> {
    try {
      const result = await db.transaction(async (tx) => {
        const insufficientItems: InsufficientStockItem[] = []

        for (const item of params.items) {
          const [current] = await tx
            .select({ stockQuantity: products.stockQuantity })
            .from(products)
            .where(eq(products.id, item.productId))
            .limit(1)
          const availableBefore = current?.stockQuantity ?? 0

          const [updated] = await tx
            .update(products)
            .set({ stockQuantity: sql`${products.stockQuantity} - ${item.quantity}`, updatedAt: new Date() })
            .where(and(eq(products.id, item.productId), sql`${products.stockQuantity} - ${item.quantity} >= 0`))
            .returning()

          if (!updated) {
            insufficientItems.push({ productId: item.productId, requested: item.quantity, available: availableBefore })
          }
        }

        if (insufficientItems.length > 0) throw new InsufficientStockSignal(insufficientItems)

        const totalInCents = params.items.reduce((sum, item) => sum + item.totalInCents, 0)

        const [order] = await tx
          .insert(orders)
          .values({
            id: params.id,
            customerId: params.customerId,
            cartId: params.cartId ?? null,
            channel: params.channel,
            totalInCents,
            deliveryType: params.deliveryType,
            address: params.address ?? null,
            paymentMethod: params.paymentMethod,
            receiptPreference: params.receiptPreference,
            notes: params.notes ?? null,
          })
          .returning()

        const insertedItems = await tx
          .insert(orderItems)
          .values(
            params.items.map((item) => ({
              id: generateId(),
              orderId: order!.id,
              productId: item.productId,
              productName: item.productName,
              unitPriceInCents: item.unitPriceInCents,
              quantity: String(item.quantity),
              totalInCents: item.totalInCents,
            })),
          )
          .returning()

        return { order: order!, items: insertedItems }
      })

      return { ok: true, order: toOrderRecord(result.order), items: result.items.map(toOrderItemRecord) }
    } catch (error) {
      if (error instanceof InsufficientStockSignal) return { ok: false, insufficientItems: error.items }
      throw error
    }
  }

  async findById(id: string): Promise<OrderRecord | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
    return order ? toOrderRecord(order) : undefined
  }

  async findByShortCode(shortCode: string): Promise<OrderRecord | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.shortCode, shortCode)).limit(1)
    return order ? toOrderRecord(order) : undefined
  }

  async findLastByCustomer(customerId: string): Promise<OrderRecord | undefined> {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt))
      .limit(1)
    return order ? toOrderRecord(order) : undefined
  }

  async listItems(orderId: string): Promise<OrderItemRecord[]> {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
    return items.map(toOrderItemRecord)
  }

  async list(params: ListOrdersRepositoryParams): Promise<ListOrdersRepositoryResult> {
    const conditions: SQL[] = []
    if (params.status && params.status.length > 0) conditions.push(inArray(orders.status, [...params.status]))
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const sortColumn = SORTABLE_COLUMNS[params.sortBy]
    const orderBy = params.sortDirection === 'desc' ? desc(sortColumn) : asc(sortColumn)
    const offset = (params.page - 1) * params.perPage

    const [items, countRows] = await Promise.all([
      db.select().from(orders).where(where).orderBy(orderBy).limit(params.perPage).offset(offset),
      db.select({ total: sql<number>`count(*)::int` }).from(orders).where(where),
    ])

    return { items: items.map(toOrderRecord), total: countRows[0]?.total ?? 0 }
  }

  async updateStatus(id: string, status: string): Promise<OrderRecord | undefined> {
    const [order] = await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id)).returning()
    return order ? toOrderRecord(order) : undefined
  }

  async cancelAndRestoreStock(id: string): Promise<OrderRecord | undefined> {
    return await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, id)).limit(1)
      if (!order) return undefined
      if (order.status === ORDER_STATUS.CANCELLED) return toOrderRecord(order)

      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, id))
      for (const item of items) {
        await tx
          .update(products)
          .set({ stockQuantity: sql`${products.stockQuantity} + ${Number(item.quantity)}`, updatedAt: new Date() })
          .where(eq(products.id, item.productId))
      }

      const [updated] = await tx
        .update(orders)
        .set({ status: ORDER_STATUS.CANCELLED, updatedAt: new Date() })
        .where(eq(orders.id, id))
        .returning()

      return toOrderRecord(updated!)
    })
  }
}
