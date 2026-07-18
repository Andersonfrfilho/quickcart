/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import {
  CategoryNotFoundError,
  ProductBarcodeDuplicateError,
  ProductNotFoundError,
} from '@/shared/errors/CatalogErrors'
import type { CategoryRepositoryInterface } from '@/modules/catalog/domain/CategoryRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { UpdateProductParams, UpdateProductResult } from '../types/UpdateProduct.types'

type UpdateProductUseCaseDependencies = {
  readonly categoryRepository: CategoryRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
}

export class UpdateProductUseCase {
  constructor(private readonly dependencies: UpdateProductUseCaseDependencies) {}

  async execute(params: UpdateProductParams): Promise<UpdateProductResult> {
    const { id, ...changes } = params

    const product = await this.dependencies.productRepository.findById(id)
    if (!product) throw new ProductNotFoundError(id)

    if (changes.categoryId) {
      const category = await this.dependencies.categoryRepository.findById(changes.categoryId)
      if (!category) throw new CategoryNotFoundError(changes.categoryId)
    }

    if (changes.barcode) {
      const existing = await this.dependencies.productRepository.findByBarcode(changes.barcode)
      if (existing && existing.id !== id) throw new ProductBarcodeDuplicateError(changes.barcode)
    }

    return this.dependencies.productRepository.update(id, changes)
  }
}
