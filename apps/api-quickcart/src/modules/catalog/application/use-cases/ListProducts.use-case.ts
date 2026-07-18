/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * onlyAvailable é decidido pelo controller (true na vitrine pública, false no admin) —
 * nunca um parâmetro vindo do client, para não vazar produtos esgotados na loja.
 */

import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { ListProductsParams, ListProductsResult } from '../types/ListProducts.types'

type ListProductsUseCaseDependencies = {
  readonly productRepository: ProductRepositoryInterface
}

export class ListProductsUseCase {
  constructor(private readonly dependencies: ListProductsUseCaseDependencies) {}

  async execute(params: ListProductsParams): Promise<ListProductsResult> {
    const { items, total } = await this.dependencies.productRepository.list(params)
    return { items, total, page: params.page, perPage: params.perPage }
  }
}
