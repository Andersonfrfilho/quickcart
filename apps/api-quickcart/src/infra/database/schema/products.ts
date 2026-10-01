/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { pgTable, uuid, varchar, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core'
import { categories } from './categories'

export const products = pgTable('products', {
  id: uuid('id').primaryKey(),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'restrict' }),
  name: varchar('name', { length: 160 }).notNull(),
  brand: varchar('brand', { length: 80 }),
  description: text('description'),
  unit: varchar('unit', { length: 16 }).notNull(),
  unitSize: varchar('unit_size', { length: 24 }),
  priceInCents: integer('price_in_cents').notNull(),
  stockQuantity: integer('stock_quantity').default(0).notNull(),
  isAvailable: boolean('is_available').default(true).notNull(),
  imageUrl: text('image_url'),
  /**
   * Onde o produto fica na loja ("Corredor 3", "Hortifruti", "Câmara fria").
   *
   * Texto livre e opcional porque cada loja nomeia o próprio espaço, e a maioria não mapeia nada:
   * quem separa lê isto para achar o item, então o valor precisa ser o que está escrito na placa
   * pendurada no corredor — não um código de endereçamento que ninguém decora.
   */
  aisle: varchar('aisle', { length: 60 }),
  aliases: text('aliases').array().default([]).notNull(),
  barcode: varchar('barcode', { length: 14 }).unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
