/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * product_name e unit_price_in_cents são snapshot no momento do pedido — não seguem
 * o produto se o catálogo mudar depois (histórico do pedido deve ser imutável).
 * quantity é lido como string ($inferSelect) — Drizzle mapeia numeric assim para não
 * perder precisão; casos de uso convertem para number no limite da aplicação.
 */

import { pgTable, uuid, varchar, integer, numeric, timestamp } from 'drizzle-orm/pg-core'
import { orders } from './orders'
import { products } from './products'

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
  productName: varchar('product_name', { length: 160 }).notNull(),
  unitPriceInCents: integer('unit_price_in_cents').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull(),
  totalInCents: integer('total_in_cents').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type OrderItem = typeof orderItems.$inferSelect
export type NewOrderItem = typeof orderItems.$inferInsert
