/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Espelha apps/api-quickcart/src/infra/database/schema/order-items.ts. `quantity` é numeric
 * — o Drizzle infere como string no select; qualquer uso em cálculo de recibo deve converter
 * com Number(item.quantity) no ponto de uso.
 */

import { pgTable, uuid, varchar, integer, numeric, timestamp } from 'drizzle-orm/pg-core'
import { orders } from './orders'

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull(),
  productName: varchar('product_name', { length: 160 }).notNull(),
  unitPriceInCents: integer('unit_price_in_cents').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull(),
  totalInCents: integer('total_in_cents').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type OrderItem = typeof orderItems.$inferSelect
export type NewOrderItem = typeof orderItems.$inferInsert
