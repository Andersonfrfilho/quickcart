/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { Router } from '@/infra/http/router'
import type { CategoryController } from './Category.controller'
import type { ProductController } from './Product.controller'

type RegisterCatalogRoutesParams = {
  readonly router: Router
  readonly categoryController: CategoryController
  readonly productController: ProductController
}

export function registerCatalogRoutes(params: RegisterCatalogRoutesParams): void {
  const { router, categoryController, productController } = params

  router.get('/v1/categories', categoryController.handleList)
  router.get('/v1/products', productController.handleListPublic)
  router.get('/v1/products/search', productController.handleSearch)

  router.get('/v1/admin/categories', categoryController.handleListAdmin)
  router.post('/v1/admin/categories', categoryController.handleCreate)

  router.get('/v1/admin/products', productController.handleListAdmin)
  router.post('/v1/admin/products', productController.handleCreate)
  router.put('/v1/admin/products/:id', productController.handleUpdate)
  router.patch('/v1/admin/products/:id/stock', productController.handleAdjustStock)
}
