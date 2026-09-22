/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cache NEGATIVO de geocodificação (T1.4, spec §3.5): sem isso, um CEP que o Nominatim não resolve
 * seria tentado de novo a cada pedido — e numa rota pública, isso vira o jeito mais fácil de estourar
 * o teto de 1 req/s da política de uso. TTL de 24h é aplicado na leitura (`failed_at`), não aqui.
 */

import { pgTable, varchar, timestamp } from 'drizzle-orm/pg-core'

export const geocodeFailures = pgTable('geocode_failures', {
  cep: varchar('cep', { length: 9 }).primaryKey(),
  failedAt: timestamp('failed_at', { withTimezone: true }).defaultNow().notNull(),
})

export type GeocodeFailureRow = typeof geocodeFailures.$inferSelect
export type NewGeocodeFailureRow = typeof geocodeFailures.$inferInsert
