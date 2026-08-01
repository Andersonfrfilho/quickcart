/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O que os clientes pediram e a loja não tinha.
 *
 * Hoje esse dado nasce e morre numa mensagem ("não encontrei: ovos"). É o único dado que o bot produz
 * que serve ao LOJISTA e não ao cliente — demanda que ele está perdendo sem saber, e que nenhuma outra
 * fonte tem: não está no histórico de vendas justamente porque a venda não aconteceu.
 *
 * Uma linha por pedido de um cliente, e não um contador por termo. Contador responde "quantas vezes",
 * o que é a pergunta fácil; a decisão de passar a vender exige saber se são dez pessoas ou uma pessoa
 * dez vezes, e quando foi a última — informação que um contador já jogou fora.
 */

import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core'
import { customers } from './customers'

export const unmatchedDemands = pgTable(
  'unmatched_demands',
  {
    id: uuid('id').primaryKey(),
    /**
     * Termo normalizado (minúsculo, sem acento), usado para agrupar.
     *
     * "Açúcar", "acucar" e "AÇÚCAR" são o mesmo pedido, e sem normalizar o relatório mostraria três
     * linhas de um item — o que faz o lojista subestimar a demanda exatamente onde ela é maior.
     */
    term: varchar('term', { length: 120 }).notNull(),
    /** Como o cliente falou, preservado: é o que revela a palavra que o catálogo deveria reconhecer. */
    rawTerm: text('raw_term').notNull(),
    /**
     * Quem pediu. `set null` na exclusão do cliente: a demanda continua sendo verdade sobre o
     * catálogo depois de o cliente sair, e apagá-la junto reescreveria o passado da loja.
     */
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    /** `list`, `resolution_skipped` — de onde veio, para separar "não achei" de "nenhum desses". */
    source: varchar('source', { length: 24 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // O relatório sempre agrupa por termo e ordena por data; sem isto ele varre a tabela inteira.
    index('unmatched_demands_term_idx').on(table.term),
    index('unmatched_demands_created_at_idx').on(table.createdAt),
  ],
)

export type UnmatchedDemand = typeof unmatchedDemands.$inferSelect
export type NewUnmatchedDemand = typeof unmatchedDemands.$inferInsert
