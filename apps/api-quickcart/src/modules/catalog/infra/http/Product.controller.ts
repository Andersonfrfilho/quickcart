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
import { validateQuery } from '@/infra/http/middlewares/validateQuery'
import type { AdjustStockUseCase } from '@/modules/catalog/application/use-cases/AdjustStock.use-case'
import type { CreateProductUseCase } from '@/modules/catalog/application/use-cases/CreateProduct.use-case'
import type { ListProductsUseCase } from '@/modules/catalog/application/use-cases/ListProducts.use-case'
import type { SearchProductsUseCase } from '@/modules/catalog/application/use-cases/SearchProducts.use-case'
import type { UpdateProductUseCase } from '@/modules/catalog/application/use-cases/UpdateProduct.use-case'
import { adjustStockSchema } from './schemas/AdjustStock.schema'
import { createProductSchema } from './schemas/CreateProduct.schema'
import { listProductsQuerySchema } from './schemas/ListProducts.schema'
import { searchProductsQuerySchema } from './schemas/SearchProducts.schema'
import { updateProductSchema } from './schemas/UpdateProduct.schema'

type ProductControllerDependencies = {
  readonly listProductsUseCase: ListProductsUseCase
  readonly searchProductsUseCase: SearchProductsUseCase
  readonly createProductUseCase: CreateProductUseCase
  readonly updateProductUseCase: UpdateProductUseCase
  readonly adjustStockUseCase: AdjustStockUseCase
}

export class ProductController {
  constructor(private readonly dependencies: ProductControllerDependencies) {}

  handleListPublic: RouteHandler = async (request, response) => {
    const query = validateQuery(listProductsQuerySchema, request.query)
    const result = await this.dependencies.listProductsUseCase.execute({ ...query, onlyAvailable: true })
    response.json(200, { data: result.items, pagination: { total: result.total, page: result.page, perPage: result.perPage } })
  }

  handleListAdmin: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ADMIN_ONLY })
    const query = validateQuery(listProductsQuerySchema, request.query)
    const result = await this.dependencies.listProductsUseCase.execute({ ...query, onlyAvailable: false })
    response.json(200, { data: result.items, pagination: { total: result.total, page: result.page, perPage: result.perPage } })
  }

  handleSearch: RouteHandler = async (request, response) => {
    const query = validateQuery(searchProductsQuerySchema, request.query)
    const results = await this.dependencies.searchProductsUseCase.execute(query)
    response.json(200, { data: results })
  }

  handleCreate: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ADMIN_ONLY })
    const input = validateBody(createProductSchema, request.body)
    const product = await this.dependencies.createProductUseCase.execute(input)
    response.json(201, { data: product })
  }

  handleUpdate: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ADMIN_ONLY })
    const id = request.params[0] ?? ''
    const input = validateBody(updateProductSchema, request.body)
    const product = await this.dependencies.updateProductUseCase.execute({ id, ...input })
    response.json(200, { data: product })
  }

  handleAdjustStock: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ADMIN_ONLY })
    const id = request.params[0] ?? ''
    const { delta } = validateBody(adjustStockSchema, request.body)
    const product = await this.dependencies.adjustStockUseCase.execute({ id, delta })
    response.json(200, { data: product })
  }
}
