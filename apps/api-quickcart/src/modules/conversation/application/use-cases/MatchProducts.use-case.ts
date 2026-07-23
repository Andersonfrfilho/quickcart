/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Classificação da spec §3.2, colapsada em uma única comparação: uma vez que o
 * top1 já passou do MATCH_MIN_THRESHOLD (senão é not_found), ele só é 'auto' se
 * bater o threshold de confiança E abrir folga suficiente para o 2º colocado
 * (tratado como score 0 quando não existe) — qualquer outro caso é 'ambiguous',
 * o que já cobre o caso confirmado com o usuário de um único candidato entre
 * MATCH_MIN_THRESHOLD e MATCH_AUTO_THRESHOLD.
 */

import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { MatchCandidate, MatchProductsParams, MatchProductsResult } from '@/modules/conversation/application/types/MatchProducts.types'
import {
  MATCH_AUTO_THRESHOLD,
  MATCH_GAP_THRESHOLD,
  MATCH_MAX_CANDIDATES,
  MATCH_MIN_THRESHOLD,
  MATCH_TYPE,
} from '@/modules/conversation/shared/Matcher.constant'

export class MatchProductsUseCase {
  constructor(private readonly productRepository: ProductRepositoryInterface) {}

  async execute(params: MatchProductsParams): Promise<MatchProductsResult> {
    const searchResults = await this.productRepository.searchByTerm(params.item.term, MATCH_MAX_CANDIDATES)
    const candidates: readonly MatchCandidate[] = searchResults
      .filter((result) => result.score >= MATCH_MIN_THRESHOLD)
      .map((result) => ({
        productId: result.id,
        name: result.name,
        brand: result.brand,
        unitSize: result.unitSize,
        priceInCents: result.priceInCents,
        score: result.score,
      }))

    const top1 = candidates[0]
    if (!top1) {
      return { item: params.item, matchType: MATCH_TYPE.NOT_FOUND, candidates: [] }
    }

    const top2Score = candidates[1]?.score ?? 0
    const isConfidentAuto = top1.score >= MATCH_AUTO_THRESHOLD && top1.score - top2Score >= MATCH_GAP_THRESHOLD
    if (isConfidentAuto) {
      return { item: params.item, matchType: MATCH_TYPE.AUTO, candidates: [top1] }
    }

    return { item: params.item, matchType: MATCH_TYPE.AMBIGUOUS, candidates }
  }
}
