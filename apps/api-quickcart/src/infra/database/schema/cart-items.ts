/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * quantity é lido como string ($inferSelect) — Drizzle mapeia numeric assim para não
 * perder precisão; casos de uso convertem para number no limite da aplicação.
 */

import { pgTable, uuid, varchar, numeric, timestamp } from 'drizzle-orm/pg-core'
import { carts } from './carts'
import { products } from './products'

export const cartItems = pgTable('cart_items', {
  id: uuid('id').primaryKey(),
  cartId: uuid('cart_id')
    .notNull()
    .references(() => carts.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
  quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull(),
  matchType: varchar('match_type', { length: 10 }).notNull(),
  originalTerm: varchar('original_term', { length: 160 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type CartItem = typeof cartItems.$inferSelect
export type NewCartItem = typeof cartItems.$inferInsert
