/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { and, count, countDistinct, desc, gte, max, sql } from 'drizzle-orm'
import { db } from '@/infra/database/connection'
import { unmatchedDemands } from '@/infra/database/schema'
import type {
  ListUnmatchedDemandsParams,
  RecordUnmatchedDemandsParams,
  UnmatchedDemandRepositoryInterface,
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
    const conditions = params.since ? [gte(unmatchedDemands.createdAt, params.since)] : []

    const rows = await db
      .select({
        term: unmatchedDemands.term,
        // O exemplo mais recente de como foi falado: `raw_term` da linha mais nova do grupo.
        lastRawTerm: sql<string>`(array_agg(${unmatchedDemands.rawTerm} order by ${unmatchedDemands.createdAt} desc))[1]`,
        requestCount: count(),
        customerCount: countDistinct(unmatchedDemands.customerId),
        lastRequestedAt: max(unmatchedDemands.createdAt),
      })
      .from(unmatchedDemands)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(unmatchedDemands.term)
      // Clientes distintos primeiro: é o número que decide passar a vender. Empate desempata por
      // recência, que separa demanda viva de item que alguém pediu há meses.
      .orderBy(desc(countDistinct(unmatchedDemands.customerId)), desc(max(unmatchedDemands.createdAt)))
      .limit(params.limit)

    return rows.map((row) => ({
      term: row.term,
      lastRawTerm: row.lastRawTerm,
      requestCount: Number(row.requestCount),
      customerCount: Number(row.customerCount),
      // `max` é nullable no tipo do Drizzle, mas o grupo só existe se houver linha.
      lastRequestedAt: row.lastRequestedAt ?? new Date(0),
    }))
  }
}
