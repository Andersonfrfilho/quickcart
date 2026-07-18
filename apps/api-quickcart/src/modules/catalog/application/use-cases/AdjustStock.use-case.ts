/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * adjustStock() no repositório é um UPDATE condicional atômico; undefined significa
 * "não aplicou" (id inexistente OU deixaria o estoque negativo) — aqui desambiguamos
 * com um findById para lançar o erro de domínio correto.
 */

import { ProductInsufficientStockError, ProductNotFoundError } from '@/shared/errors/CatalogErrors'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { AdjustStockParams, AdjustStockResult } from '../types/AdjustStock.types'

type AdjustStockUseCaseDependencies = {
  readonly productRepository: ProductRepositoryInterface
}

export class AdjustStockUseCase {
  constructor(private readonly dependencies: AdjustStockUseCaseDependencies) {}

  async execute(params: AdjustStockParams): Promise<AdjustStockResult> {
    const updated = await this.dependencies.productRepository.adjustStock(params.id, params.delta)
    if (updated) return updated

    const product = await this.dependencies.productRepository.findById(params.id)
    if (!product) throw new ProductNotFoundError(params.id)

    throw new ProductInsufficientStockError(params.id, Math.abs(params.delta), product.stockQuantity)
  }
}
