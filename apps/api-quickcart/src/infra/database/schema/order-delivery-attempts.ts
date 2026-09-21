/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Uma linha por VIAGEM, não por pedido.
 *
 * `orders.delivery_failure_reason` guarda só a ocorrência corrente, e ela é apagada quando o pedido volta
 * para a rua — a regra existe para a tela não mostrar o motivo de uma viagem que já acabou. O efeito
 * colateral é que a segunda tentativa destrói o registro da primeira: hoje ninguém consegue responder
 * quantas vezes a sacola saiu nem por que voltou de cada vez.
 *
 * Aqui nada é sobrescrito. A viagem nasce quando o pedido sai, fecha com desfecho quando chega ao fim, e
 * a próxima é outra linha.
 */

import { pgTable, uuid, varchar, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { orders } from './orders'

export const orderDeliveryAttempts = pgTable(
  'order_delivery_attempts',
  {
    id: uuid('id').primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    /** 1, 2, 3… na ordem em que a sacola saiu. É o que a tela numera ("2ª tentativa"). */
    attempt: integer('attempt').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    /**
     * `null` = viagem em andamento, e é o que torna esta tabela append-only sem perder o "agora":
     * a tentativa aberta é a única sem desfecho, então achá-la não depende de comparar datas.
     */
    endedAt: timestamp('ended_at', { withTimezone: true }),
    /** `delivered` ou `failed`. Nulo enquanto a viagem não terminou. */
    outcome: varchar('outcome', { length: 12 }),
    /** Só preenchido com `outcome = failed`, e com o mesmo vocabulário de `DELIVERY_FAILURE_REASON`. */
    failureReason: varchar('failure_reason', { length: 20 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('order_delivery_attempts_order_attempt_idx').on(table.orderId, table.attempt),
    index('order_delivery_attempts_order_idx').on(table.orderId, table.startedAt),
  ],
)

export type OrderDeliveryAttempt = typeof orderDeliveryAttempts.$inferSelect
export type NewOrderDeliveryAttempt = typeof orderDeliveryAttempts.$inferInsert
