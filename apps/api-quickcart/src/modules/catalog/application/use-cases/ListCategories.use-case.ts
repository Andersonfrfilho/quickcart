/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { CategoryRepositoryInterface } from '@/modules/catalog/domain/CategoryRepository.interface'
import type { ListCategoriesResult } from '../types/ListCategories.types'

type ListCategoriesUseCaseDependencies = {
  readonly categoryRepository: CategoryRepositoryInterface
}

export class ListCategoriesUseCase {
  constructor(private readonly dependencies: ListCategoriesUseCaseDependencies) {}

  async execute(): Promise<ListCategoriesResult> {
    return this.dependencies.categoryRepository.list()
  }
}
