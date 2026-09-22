/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { describe, expect, it } from 'bun:test'

import { WHATSAPP_CHOICE_LIMIT } from '@adatechnology/meta-whatsapp-contracts'
import type { MatchCandidate } from '@/modules/conversation/application/types/MatchProducts.types'
import { buildResolveSection } from '@/modules/conversation/application/handlers/support/InteractiveListBuilders'
import { MATCH_MAX_AMBIGUOUS_CANDIDATES } from '@/modules/conversation/shared/Matcher.constant'
import { RESOLVE_ROW_ID, RESOLVE_ROW_PREFIX } from '@/modules/conversation/shared/Messages.constant'

type BuildCandidatesParams = {
  readonly count: number
  readonly isInterchangeable: boolean
}

// Relevância decrescente pelo índice. O primeiro é o mais caro, para provar que a paginação não o descarta.
function buildCandidates({ count, isInterchangeable }: BuildCandidatesParams): MatchCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    productId: `rice-${index}`,
    name: isInterchangeable ? 'Arroz Branco' : `Arroz ${index}`,
    brand: `Marca ${index}`,
    unitSize: '5kg',
    priceInCents: index === 0 ? 99_999 : 1_000 + index,
    score: 1 - index / 100,
  }))
}

function buildPending(candidates: readonly MatchCandidate[], page?: number) {
  return { originalTerm: 'arroz', quantity: 1, unit: 'un', candidates, ...(page ? { page } : {}) }
}

describe('buildResolveSection', () => {
  it('nunca passa do teto de linhas da Meta, mesmo no máximo de candidatos ambíguos guardados no contexto', () => {
    const section = buildResolveSection(
      buildPending(buildCandidates({ count: MATCH_MAX_AMBIGUOUS_CANDIDATES, isInterchangeable: true })),
    )

    expect(section.rows.length).toBeLessThanOrEqual(WHATSAPP_CHOICE_LIMIT.LIST_ROWS)
  })

  it('mostra a linha de próxima página só quando sobram candidatos', () => {
    const withMore = buildResolveSection(
      buildPending(buildCandidates({ count: MATCH_MAX_AMBIGUOUS_CANDIDATES, isInterchangeable: false })),
    )
    expect(withMore.rows.map((row) => row.id)).toContain(RESOLVE_ROW_ID.NEXT_PAGE)

    const withoutMore = buildResolveSection(buildPending(buildCandidates({ count: 3, isInterchangeable: false })))
    expect(withoutMore.rows.map((row) => row.id)).not.toContain(RESOLVE_ROW_ID.NEXT_PAGE)
  })

  it('mantém todos os candidatos quando cabem numa página só', () => {
    const section = buildResolveSection(buildPending(buildCandidates({ count: 3, isInterchangeable: false })))

    expect(section.rows).toHaveLength(4)
  })

  it('a última página é alcançável e contém os candidatos restantes, sem repetir a próxima página', () => {
    const candidates = buildCandidates({ count: 10, isInterchangeable: false })
    const firstPage = buildResolveSection(buildPending(candidates, 1))
    const firstPageCandidateIds = firstPage.rows
      .map((row) => row.id)
      .filter((id) => id.startsWith(RESOLVE_ROW_PREFIX.PRODUCT))

    expect(firstPage.rows.map((row) => row.id)).toContain(RESOLVE_ROW_ID.NEXT_PAGE)

    const secondPage = buildResolveSection(buildPending(candidates, 2))
    const secondPageCandidateIds = secondPage.rows
      .map((row) => row.id)
      .filter((id) => id.startsWith(RESOLVE_ROW_PREFIX.PRODUCT))

    expect(secondPage.rows.map((row) => row.id)).not.toContain(RESOLVE_ROW_ID.NEXT_PAGE)
    expect(firstPageCandidateIds.length + secondPageCandidateIds.length).toBe(candidates.length)
    expect(new Set([...firstPageCandidateIds, ...secondPageCandidateIds]).size).toBe(candidates.length)
  })

  it('candidatos dentro de uma página aparecem ordenados por preço crescente', () => {
    const section = buildResolveSection(
      buildPending(buildCandidates({ count: 3, isInterchangeable: false })),
    )
    const candidateIds = section.rows.map((row) => row.id).filter((id) => id.startsWith(RESOLVE_ROW_PREFIX.PRODUCT))

    // rice-0 é o mais caro (99_999) — some para o fim da página, mesmo sendo o mais relevante.
    expect(candidateIds.at(-1)).toBe(`${RESOLVE_ROW_PREFIX.PRODUCT}rice-0`)
  })
})
