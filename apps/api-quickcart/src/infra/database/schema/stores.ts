/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O endereço da loja, com coordenada — hoje é `STORE_ADDRESS`, texto livre em env, usado só para
 * imprimir no recibo. Sem coordenada da loja não há de onde medir a distância até o cliente.
 *
 * Sem `company_id` de propósito: nenhuma outra tabela deste schema tem tenant (`orders`, `customers`
 * não carregam a coluna, e não existe tabela `companies`). O projeto é uma loja por deployment — a
 * própria env var que esta tabela substitui já era assim. Adicionar tenant aqui sozinho criaria uma
 * coluna que nenhum outro lugar do sistema lê nem popula.
 *
 * A env var continua sendo lida no boot para popular a linha inicial (spec §8 Q3); depois disso quem
 * manda é a tabela.
 */

import { pgTable, uuid, varchar, numeric, timestamp } from 'drizzle-orm/pg-core'

export const stores = pgTable('stores', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  cep: varchar('cep', { length: 9 }).notNull(),
  street: varchar('street', { length: 160 }).notNull(),
  number: varchar('number', { length: 20 }).notNull(),
  complement: varchar('complement', { length: 80 }),
  neighborhood: varchar('neighborhood', { length: 80 }).notNull(),
  city: varchar('city', { length: 80 }).notNull(),
  state: varchar('state', { length: 2 }).notNull(),
  reference: varchar('reference', { length: 160 }),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  geocodePrecision: varchar('geocode_precision', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Store = typeof stores.$inferSelect
export type NewStore = typeof stores.$inferInsert
