/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Mesma query trigram usada pelo MatchProducts.use-case da Fase 4 (spec §3.2) —
 * a fonte da verdade é ProductRepositoryInterface.searchByTerm, nunca duplicar o SQL.
 */

import { ProductSearchQueryTooShortError } from '@/shared/errors/CatalogErrors'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import { SEARCH_DEFAULT_LIMIT, SEARCH_MIN_QUERY_LENGTH } from '@/modules/catalog/shared/Catalog.constant'
import type { SearchProductsParams, SearchProductsResult } from '../types/SearchProducts.types'

type SearchProductsUseCaseDependencies = {
  readonly productRepository: ProductRepositoryInterface
}

export class SearchProductsUseCase {
  constructor(private readonly dependencies: SearchProductsUseCaseDependencies) {}

  async execute(params: SearchProductsParams): Promise<SearchProductsResult> {
    const term = params.query.trim()
    if (term.length < SEARCH_MIN_QUERY_LENGTH) throw new ProductSearchQueryTooShortError(SEARCH_MIN_QUERY_LENGTH)

    return this.dependencies.productRepository.searchByTerm(term, params.limit ?? SEARCH_DEFAULT_LIMIT)
  }
}
