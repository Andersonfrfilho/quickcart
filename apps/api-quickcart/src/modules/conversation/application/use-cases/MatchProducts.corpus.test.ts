/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Roda o corpus (`matchProductsCorpus.constant.ts`) pelo `MatchProductsUseCase`, e não pelo
 * `searchByTerm`: o limiar de 0,3 que separa "achei" de "não encontrei" mora no use case, e é ele que
 * o cliente sente.
 *
 * Integração contra o catálogo semeado por `make seed ENV=test` — mesma exigência do
 * `DrizzleProductRepository.test.ts`. Não fecha o pool: `db` é singleton do processo `bun test`.
 */

import { describe, expect, it } from 'bun:test'
import { DrizzleProductRepository } from '@/modules/catalog/infra/database/DrizzleProductRepository'
import { MatchProductsUseCase } from '@/modules/conversation/application/use-cases/MatchProducts.use-case'
import { MATCH_TYPE } from '@/modules/conversation/shared/Matcher.constant'
import { MUST_MATCH, MUST_NOT_MATCH } from '@/modules/conversation/shared/matchProductsCorpus.constant'

const matchProducts = new MatchProductsUseCase(new DrizzleProductRepository())

async function matchTerm(term: string) {
  return matchProducts.execute({ item: { term, quantity: 1, unit: 'un' } })
}

describe('corpus de busca de produto — MUST_MATCH', () => {
  it.each(MUST_MATCH.map((entry) => [entry.term, entry] as const))(
    '"%s" acha o produto esperado',
    async (_term, entry) => {
      const result = await matchTerm(entry.term)

      expect(result.matchType).not.toBe(MATCH_TYPE.NOT_FOUND)
      expect(result.candidates[0]?.name.startsWith(entry.expectedTopName)).toBe(true)
    },
  )
})

describe('corpus de busca de produto — MUST_NOT_MATCH', () => {
  it.each(MUST_NOT_MATCH.map((entry) => [entry.term, entry] as const))(
    '"%s" segue sem produto',
    async (_term, entry) => {
      const result = await matchTerm(entry.term)

      expect(result.matchType).toBe(MATCH_TYPE.NOT_FOUND)
      expect(result.candidates).toEqual([])
    },
  )
})
