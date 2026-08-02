/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { and, asc, count, countDistinct, desc, gte, ilike, inArray, max, sql, type SQL } from 'drizzle-orm'
import { db } from '@/infra/database/connection'
import { unmatchedDemands } from '@/infra/database/schema'
import type {
  ListUnmatchedDemandsParams,
  RecordUnmatchedDemandsParams,
  UnmatchedDemandRepositoryInterface,
  UnmatchedDemandSortableField,
  UnmatchedDemandSortDirection,
  UnmatchedDemandSource,
  UnmatchedDemandSummary,
} from '@/modules/conversation/domain/UnmatchedDemandRepository.interface'
import { generateId } from '@/shared/id'

/** Teto do campo. Termo mais longo que isso é ruído de transcrição, não pedido. */
const TERM_MAX_LENGTH = 120

/**
 * Agrupa "Açúcar", "açucar" e "AÇÚCAR" no mesmo pedido.
 *
 * Sem normalizar, o relatório mostra três linhas de um item, e o lojista subestima a demanda exatamente
 * onde ela é maior — o oposto do que o relatório existe para fazer.
 */
export function normalizeDemandTerm(rawTerm: string): string {
  return rawTerm
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .slice(0, TERM_MAX_LENGTH)
}

/**
 * As mesmas expressões que o SELECT agrega, reaproveitadas no ORDER BY.
 *
 * Ordenar por agregado exige repetir a expressão (Postgres não aceita apelido do SELECT no ORDER BY de
 * consulta agrupada); declarar aqui é o que impede a ordem divergir silenciosamente da coluna exibida.
 */
const SORTABLE_EXPRESSIONS = {
  customerCount: countDistinct(unmatchedDemands.customerId),
  requestCount: count(),
  lastRequestedAt: max(unmatchedDemands.createdAt),
  term: unmatchedDemands.term,
} as const

type BuildOrderByParams = {
  readonly sortBy: UnmatchedDemandSortableField
  readonly sortDirection: UnmatchedDemandSortDirection
}

/**
 * Sempre um segundo critério: sem ele, termos empatados trocam de lugar entre duas aberturas da tela,
 * e o lojista deixa de confiar na lista que devia guiar a compra.
 *
 * Recência desempata as contagens porque separa demanda viva de item pedido há meses; quando a própria
 * recência é o critério principal, o alfabeto assume — é o único desempate que não empata de novo.
 */
function buildOrderBy(params: BuildOrderByParams): SQL[] {
  const applyDirection = params.sortDirection === 'asc' ? asc : desc
  const primary = applyDirection(SORTABLE_EXPRESSIONS[params.sortBy])

  if (params.sortBy === 'lastRequestedAt') return [primary, asc(unmatchedDemands.term)]
  return [primary, desc(SORTABLE_EXPRESSIONS.lastRequestedAt)]
}

export class DrizzleUnmatchedDemandRepository implements UnmatchedDemandRepositoryInterface {
  async record(params: RecordUnmatchedDemandsParams): Promise<void> {
    const rows = params.terms
      .map((rawTerm) => ({ rawTerm: rawTerm.trim(), term: normalizeDemandTerm(rawTerm) }))
      .filter((row) => row.term.length > 0)
      .map((row) => ({
        id: generateId(),
        term: row.term,
        rawTerm: row.rawTerm.slice(0, TERM_MAX_LENGTH * 4),
        customerId: params.customerId,
        source: params.source,
      }))

    if (rows.length === 0) return

    await db.insert(unmatchedDemands).values(rows)
  }

  async listSummary(params: ListUnmatchedDemandsParams): Promise<UnmatchedDemandSummary[]> {
    const conditions: SQL[] = []

    if (params.since) conditions.push(gte(unmatchedDemands.createdAt, params.since))

    // No WHERE, não no HAVING: o filtro é sobre o motivo de cada pedido, e motivo é atributo da linha.
    if (params.sources && params.sources.length > 0) {
      conditions.push(inArray(unmatchedDemands.source, [...params.sources]))
    }

    /**
     * Busca sobre o termo normalizado, com o texto digitado normalizado do mesmo jeito.
     *
     * Sem isso, quem digita "Açúcar" não acha a linha gravada como "acucar" — e concluiria que o
     * relatório perdeu a demanda. `%` e `_` saem porque são curinga do `like`.
     */
    if (params.search) {
      const pattern = `%${normalizeDemandTerm(params.search).replace(/[%_]/g, '')}%`
      conditions.push(ilike(unmatchedDemands.term, pattern))
    }

    const rows = await db
      .select({
        term: unmatchedDemands.term,
        // O exemplo mais recente de como foi falado: `raw_term` da linha mais nova do grupo.
        lastRawTerm: sql<string>`(array_agg(${unmatchedDemands.rawTerm} order by ${unmatchedDemands.createdAt} desc))[1]`,
        requestCount: count(),
        customerCount: countDistinct(unmatchedDemands.customerId),
        lastRequestedAt: max(unmatchedDemands.createdAt),
        // `distinct` para o mesmo motivo repetido em dez pedidos não virar dez entradas no badge.
        sources: sql<UnmatchedDemandSource[]>`array_agg(distinct ${unmatchedDemands.source})`,
      })
      .from(unmatchedDemands)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(unmatchedDemands.term)
      .orderBy(...buildOrderBy({ sortBy: params.sortBy, sortDirection: params.sortDirection }))
      .limit(params.limit)

    return rows.map((row) => ({
      term: row.term,
      lastRawTerm: row.lastRawTerm,
      requestCount: Number(row.requestCount),
      customerCount: Number(row.customerCount),
      // `max` é nullable no tipo do Drizzle, mas o grupo só existe se houver linha.
      lastRequestedAt: row.lastRequestedAt ?? new Date(0),
      sources: row.sources ?? [],
    }))
  }
}
