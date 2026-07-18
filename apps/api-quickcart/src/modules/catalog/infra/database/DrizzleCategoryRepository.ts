/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { asc, eq } from 'drizzle-orm'
import { db } from '@/infra/database/connection'
import { categories, type Category } from '@/infra/database/schema'
import type {
  CategoryRepositoryInterface,
  CreateCategoryRecordParams,
} from '@/modules/catalog/domain/CategoryRepository.interface'

export class DrizzleCategoryRepository implements CategoryRepositoryInterface {
  async create(params: CreateCategoryRecordParams): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values({
        id: params.id,
        name: params.name,
        sortOrder: params.sortOrder,
        emoji: params.emoji ?? null,
      })
      .returning()

    return category as Category
  }

  async findByName(name: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.name, name)).limit(1)
    return category
  }

  async findById(id: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id)).limit(1)
    return category
  }

  async list(): Promise<Category[]> {
    return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name))
  }
}
