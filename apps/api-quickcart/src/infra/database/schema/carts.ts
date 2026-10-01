/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { sql } from 'drizzle-orm'
import { pgTable, pgSequence, uuid, varchar, timestamp } from 'drizzle-orm/pg-core'
import { customers } from './customers'

export const cartShortCodeSeq = pgSequence('cart_short_code_seq', { startWith: 1000, increment: 1 })

export const carts = pgTable('carts', {
  id: uuid('id').primaryKey(),
  /**
   * O código da compra, do jeito que o cliente e o balcão falam dela antes de existir pedido.
   *
   * Continuar a lista mantém o código; começar do zero abre outro carrinho, com código novo — é essa
   * troca que distingue duas compras do mesmo cliente no mesmo dia.
   */
  shortCode: varchar('short_code', { length: 12 })
    .notNull()
    .unique()
    .default(sql`('LC-' || nextval('cart_short_code_seq')::text)`),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'restrict' }),
  channel: varchar('channel', { length: 10 }).notNull(),
  status: varchar('status', { length: 16 }).default('open').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Cart = typeof carts.$inferSelect
export type NewCart = typeof carts.$inferInsert
