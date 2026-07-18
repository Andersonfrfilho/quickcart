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
import { CategoryNameDuplicateError } from '@/shared/errors/CatalogErrors'
import type { CategoryRepositoryInterface } from '@/modules/catalog/domain/CategoryRepository.interface'
import type { CreateCategoryParams, CreateCategoryResult } from '../types/CreateCategory.types'

type CreateCategoryUseCaseDependencies = {
  readonly categoryRepository: CategoryRepositoryInterface
}

export class CreateCategoryUseCase {
  constructor(private readonly dependencies: CreateCategoryUseCaseDependencies) {}

  async execute(params: CreateCategoryParams): Promise<CreateCategoryResult> {
    const existing = await this.dependencies.categoryRepository.findByName(params.name)
    if (existing) throw new CategoryNameDuplicateError(params.name)

    return this.dependencies.categoryRepository.create({
      id: generateId(),
      name: params.name,
      sortOrder: params.sortOrder,
      emoji: params.emoji,
    })
  }
}
