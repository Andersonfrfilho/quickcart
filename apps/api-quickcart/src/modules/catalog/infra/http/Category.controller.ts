/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { RouteHandler } from '@/infra/http/router'
import { requireSession } from '@/infra/http/middlewares/requireSession'
import { ADMIN_ONLY } from '@/modules/user/shared/User.constant'
import { validateBody } from '@/infra/http/middlewares/validateBody'
import type { CreateCategoryUseCase } from '@/modules/catalog/application/use-cases/CreateCategory.use-case'
import type { ListCategoriesUseCase } from '@/modules/catalog/application/use-cases/ListCategories.use-case'
import { createCategorySchema } from './schemas/CreateCategory.schema'

type CategoryControllerDependencies = {
  readonly createCategoryUseCase: CreateCategoryUseCase
  readonly listCategoriesUseCase: ListCategoriesUseCase
}

export class CategoryController {
  constructor(private readonly dependencies: CategoryControllerDependencies) {}

  handleList: RouteHandler = async (_request, response) => {
    const categories = await this.dependencies.listCategoriesUseCase.execute()
    response.json(200, { data: categories })
  }

  handleListAdmin: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ADMIN_ONLY })
    const categories = await this.dependencies.listCategoriesUseCase.execute()
    response.json(200, { data: categories })
  }

  handleCreate: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ADMIN_ONLY })
    const input = validateBody(createCategorySchema, request.body)
    const category = await this.dependencies.createCategoryUseCase.execute(input)
    response.json(201, { data: category })
  }
}
