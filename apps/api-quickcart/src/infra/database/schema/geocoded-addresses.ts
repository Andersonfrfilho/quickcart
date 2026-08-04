/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cache de geocodificação, indexado pelo CEP — não pelo endereço, e não por cliente.
 *
 * CEP → coordenada é estável: não muda entre pedidos, nem entre clientes do mesmo prédio. Uma loja
 * atende um raio finito, então o conjunto de CEPs atendidos converge em semanas, e depois do
 * aquecimento o custo de geocodificação de um pedido novo tende a zero chamadas externas — é isso
 * que torna viável usar o Nominatim (1 req/s, uso em massa proibido) sem pagar por um provedor.
 *
 * Sem dado pessoal: CEP não identifica pessoa, e é por isso que este cache pode ser global.
 */

import { pgTable, varchar, numeric, timestamp } from 'drizzle-orm/pg-core'

export const geocodedAddresses = pgTable('geocoded_addresses', {
  cep: varchar('cep', { length: 9 }).primaryKey(),
  latitude: numeric('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: numeric('longitude', { precision: 10, scale: 7 }).notNull(),
  /**
   * Acompanha a coordenada porque a precisão varia muito: CEP de logradouro em capital chega a
   * ~100–500 m, CEP genérico `-000` de cidade pequena é o centroide do município e pode errar
   * quilômetros. Mostrar "2,3 km" com a mesma confiança para os dois estaria mentindo ao operador.
   */
  precision: varchar('precision', { length: 20 }).notNull(),
  provider: varchar('provider', { length: 40 }).notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }).defaultNow().notNull(),
})

export type GeocodedAddress = typeof geocodedAddresses.$inferSelect
export type NewGeocodedAddress = typeof geocodedAddresses.$inferInsert
