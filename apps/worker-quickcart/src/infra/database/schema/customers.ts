/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Espelha apps/api-quickcart/src/infra/database/schema/customers.ts — a migração é
 * responsabilidade exclusiva da api, este arquivo só declara o shape para leitura.
 */

import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core'

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 120 }),
  email: varchar('email', { length: 160 }),
  defaultAddress: jsonb('default_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
