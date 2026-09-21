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
  // 32, e não 20: `awaiting_customer_decision` tem 26 e não cabia. Aumentar varchar no Postgres é
  // mudança só de catálogo, sem reescrever a tabela — o inverso não seria.
  status: varchar('status', { length: 32 }).default('pending_confirmation').notNull(),
  totalInCents: integer('total_in_cents').notNull(),
  deliveryType: varchar('delivery_type', { length: 10 }).notNull(),
  address: jsonb('address'),
  /**
   * O texto original de pedidos gravados antes do endereço estruturado (`Address.schema.ts`).
   *
   * Nenhum pedido histórico é reescrito com endereço adivinhado: se o backfill não achar CEP no
   * texto livre, `address` fica nulo e o texto original mora aqui — endereço de entrega inventado
   * por heurística é pior que ausente.
   */
  legacyAddressText: text('legacy_address_text'),
  paymentMethod: varchar('payment_method', { length: 20 }).notNull(),
  receiptPreference: varchar('receipt_preference', { length: 10 }).notNull(),
  fiscalDocumentId: varchar('fiscal_document_id', { length: 60 }),
  notes: text('notes'),
  /**
   * Quando a pergunta sobre os itens em falta foi enviada. `null` = nunca perguntamos.
   *
   * Separado de `updated_at` porque é dele que sai "esperando o cliente há 40 min", que é a
   * informação que decide se alguém liga — e `updated_at` muda a cada marcação de item.
   */
  /**
   * Por que a entrega não aconteceu. Só faz sentido com `status = delivery_failed`.
   *
   * Nulo em todo o resto porque "sem ocorrência" é a ausência do motivo, não um valor — um default como
   * `'none'` obrigaria toda leitura a saber que aquele valor não conta.
   */
  deliveryFailureReason: varchar('delivery_failure_reason', { length: 20 }),
  customerDecisionAskedAt: timestamp('customer_decision_asked_at', { withTimezone: true }),
  /** Cobrança única (a resposta escolhida na regra de fluxo). Preenchido = não cobra de novo. */
  customerDecisionRemindedAt: timestamp('customer_decision_reminded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
