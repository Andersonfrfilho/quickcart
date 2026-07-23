/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * short_code usa uma sequence do Postgres (não um counter em app) porque a geração
 * precisa ser atômica sob criação concorrente de pedidos (T5.6) sem lock explícito.
 */

import { sql } from 'drizzle-orm'
import { pgTable, pgSequence, uuid, varchar, integer, jsonb, text, timestamp } from 'drizzle-orm/pg-core'
import { customers } from './customers'
import { carts } from './carts'

export const orderShortCodeSeq = pgSequence('order_short_code_seq', { startWith: 1000, increment: 1 })

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey(),
  shortCode: varchar('short_code', { length: 8 })
    .notNull()
    .unique()
    .default(sql`('QC-' || nextval('order_short_code_seq')::text)`),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'restrict' }),
  cartId: uuid('cart_id').references(() => carts.id, { onDelete: 'set null' }),
  channel: varchar('channel', { length: 10 }).notNull(),
  status: varchar('status', { length: 20 }).default('pending_confirmation').notNull(),
  totalInCents: integer('total_in_cents').notNull(),
  deliveryType: varchar('delivery_type', { length: 10 }).notNull(),
  address: jsonb('address'),
  paymentMethod: varchar('payment_method', { length: 20 }).notNull(),
  receiptPreference: varchar('receipt_preference', { length: 10 }).notNull(),
  fiscalDocumentId: varchar('fiscal_document_id', { length: 60 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
