/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { generateId } from '@/shared/id'
import { CategoryNotFoundError, ProductBarcodeDuplicateError } from '@/shared/errors/CatalogErrors'
import type { CategoryRepositoryInterface } from '@/modules/catalog/domain/CategoryRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { CreateProductParams, CreateProductResult } from '../types/CreateProduct.types'

type CreateProductUseCaseDependencies = {
  readonly categoryRepository: CategoryRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
}

export class CreateProductUseCase {
  constructor(private readonly dependencies: CreateProductUseCaseDependencies) {}

  async execute(params: CreateProductParams): Promise<CreateProductResult> {
    const category = await this.dependencies.categoryRepository.findById(params.categoryId)
    if (!category) throw new CategoryNotFoundError(params.categoryId)

    if (params.barcode) {
      const existing = await this.dependencies.productRepository.findByBarcode(params.barcode)
      if (existing) throw new ProductBarcodeDuplicateError(params.barcode)
    }

    return this.dependencies.productRepository.create({ id: generateId(), ...params })
  }
}
