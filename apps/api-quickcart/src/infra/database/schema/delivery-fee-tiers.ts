/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * As faixas de taxa por distância (spec §3.1). Formato "até X km": a faixa i cobre
 * (X[i-1], X[i]], e é o painel que substitui a lista inteira numa transação — nunca uma
 * linha isolada — por isso não há mais colunas de auditoria aqui além de criado/atualizado.
 */

import { pgTable, uuid, numeric, integer, timestamp, uniqueIndex, check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const deliveryFeeTiers = pgTable(
  'delivery_fee_tiers',
  {
    id: uuid('id').primaryKey(),
    maxDistanceKm: numeric('max_distance_km', { precision: 5, scale: 2 }).notNull(),
    feeInCents: integer('fee_in_cents').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('delivery_fee_tiers_max_distance_km_idx').on(table.maxDistanceKm),
    check('delivery_fee_tiers_max_distance_km_check', sql`${table.maxDistanceKm} > 0`),
    check('delivery_fee_tiers_fee_in_cents_check', sql`${table.feeInCents} >= 0`),
  ],
)

export type DeliveryFeeTierRow = typeof deliveryFeeTiers.$inferSelect
export type NewDeliveryFeeTierRow = typeof deliveryFeeTiers.$inferInsert
