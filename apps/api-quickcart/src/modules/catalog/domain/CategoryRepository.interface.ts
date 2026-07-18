/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { Category } from '@/infra/database/schema'

export type CreateCategoryRecordParams = {
  readonly id: string
  readonly name: string
  readonly sortOrder: number
  readonly emoji?: string | undefined
}

export interface CategoryRepositoryInterface {
  create(params: CreateCategoryRecordParams): Promise<Category>
  findByName(name: string): Promise<Category | undefined>
  findById(id: string): Promise<Category | undefined>
  list(): Promise<Category[]>
}
