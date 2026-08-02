/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { pgTable, uuid, varchar, jsonb, text, timestamp } from 'drizzle-orm/pg-core'

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 120 }),
  email: varchar('email', { length: 160 }),
  defaultAddress: jsonb('default_address'),
  /** Mesma razão de `orders.legacyAddressText`: nenhum endereço de cliente é reescrito por heurística. */
  legacyAddressText: text('legacy_address_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
