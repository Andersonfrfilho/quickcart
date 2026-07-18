/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Container de injeção de dependência manual: instancia repositórios, use-cases e
 * controllers uma única vez por processo e expõe tudo como um objeto plano.
 */

import { DatabaseHealthChecker } from '@/infra/database/DatabaseHealthChecker'
import { RedisHealthChecker } from '@/infra/redis/RedisHealthChecker'
import { GetHealthStatusUseCase } from '@/modules/health/application/use-cases/GetHealthStatus.use-case'
import { HealthController } from '@/modules/health/infra/http/Health.controller'
import { DrizzleCategoryRepository } from '@/modules/catalog/infra/database/DrizzleCategoryRepository'
import { DrizzleProductRepository } from '@/modules/catalog/infra/database/DrizzleProductRepository'
import { AdjustStockUseCase } from '@/modules/catalog/application/use-cases/AdjustStock.use-case'
import { CreateCategoryUseCase } from '@/modules/catalog/application/use-cases/CreateCategory.use-case'
import { CreateProductUseCase } from '@/modules/catalog/application/use-cases/CreateProduct.use-case'
import { ListCategoriesUseCase } from '@/modules/catalog/application/use-cases/ListCategories.use-case'
import { ListProductsUseCase } from '@/modules/catalog/application/use-cases/ListProducts.use-case'
import { SearchProductsUseCase } from '@/modules/catalog/application/use-cases/SearchProducts.use-case'
import { UpdateProductUseCase } from '@/modules/catalog/application/use-cases/UpdateProduct.use-case'
import { CategoryController } from '@/modules/catalog/infra/http/Category.controller'
import { ProductController } from '@/modules/catalog/infra/http/Product.controller'

type HealthModule = {
  readonly controller: HealthController
}

function buildHealthModule(): HealthModule {
  const databaseHealthChecker = new DatabaseHealthChecker()
  const cacheHealthChecker = new RedisHealthChecker()
  const getHealthStatusUseCase = new GetHealthStatusUseCase({ databaseHealthChecker, cacheHealthChecker })
  const controller = new HealthController(getHealthStatusUseCase)

  return { controller }
}

type CatalogModule = {
  readonly categoryController: CategoryController
  readonly productController: ProductController
}

function buildCatalogModule(): CatalogModule {
  const categoryRepository = new DrizzleCategoryRepository()
  const productRepository = new DrizzleProductRepository()

  const createCategoryUseCase = new CreateCategoryUseCase({ categoryRepository })
  const listCategoriesUseCase = new ListCategoriesUseCase({ categoryRepository })
  const createProductUseCase = new CreateProductUseCase({ categoryRepository, productRepository })
  const updateProductUseCase = new UpdateProductUseCase({ categoryRepository, productRepository })
  const adjustStockUseCase = new AdjustStockUseCase({ productRepository })
  const listProductsUseCase = new ListProductsUseCase({ productRepository })
  const searchProductsUseCase = new SearchProductsUseCase({ productRepository })

  const categoryController = new CategoryController({ createCategoryUseCase, listCategoriesUseCase })
  const productController = new ProductController({
    listProductsUseCase,
    searchProductsUseCase,
    createProductUseCase,
    updateProductUseCase,
    adjustStockUseCase,
  })

  return { categoryController, productController }
}

export const container = {
  health: buildHealthModule(),
  catalog: buildCatalogModule(),
}
