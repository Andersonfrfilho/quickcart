/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Popula o catálogo instanciando os próprios use-cases da aplicação (nunca INSERT
 * bruto), simulando a jornada real de cadastro de categorias e produtos.
 */

import { closeDatabaseConnection } from '@/infra/database/connection'
import { logger } from '@/shared/logger'
import { DrizzleCategoryRepository } from '@/modules/catalog/infra/database/DrizzleCategoryRepository'
import { DrizzleProductRepository } from '@/modules/catalog/infra/database/DrizzleProductRepository'
import { CreateCategoryUseCase } from '@/modules/catalog/application/use-cases/CreateCategory.use-case'
import { CreateProductUseCase } from '@/modules/catalog/application/use-cases/CreateProduct.use-case'
import { SEED_CATEGORIES } from './CatalogSeedCategories'
import { SEED_PRODUCTS } from './CatalogSeedProducts'

const log = logger.child('SeedScript')

async function seedCatalog(): Promise<void> {
  const categoryRepository = new DrizzleCategoryRepository()
  const productRepository = new DrizzleProductRepository()
  const createCategoryUseCase = new CreateCategoryUseCase({ categoryRepository })
  const createProductUseCase = new CreateProductUseCase({ categoryRepository, productRepository })

  const categoryIdByKey = new Map<string, string>()

  for (const seedCategory of SEED_CATEGORIES) {
    const category = await createCategoryUseCase.execute({
      name: seedCategory.name,
      sortOrder: seedCategory.sortOrder,
      emoji: seedCategory.emoji,
    })
    categoryIdByKey.set(seedCategory.key, category.id)
  }
  log.info('categories_seeded', { count: SEED_CATEGORIES.length })

  for (const seedProduct of SEED_PRODUCTS) {
    const categoryId = categoryIdByKey.get(seedProduct.categoryKey)
    if (!categoryId) throw new Error(`Unknown category key: ${seedProduct.categoryKey}`)

    await createProductUseCase.execute({
      categoryId,
      name: seedProduct.name,
      brand: seedProduct.brand,
      unit: seedProduct.unit,
      unitSize: seedProduct.unitSize,
      priceInCents: seedProduct.priceInCents,
      stockQuantity: seedProduct.stockQuantity,
      isAvailable: true,
      aliases: seedProduct.aliases,
    })
  }
  log.info('products_seeded', { count: SEED_PRODUCTS.length })
}

seedCatalog()
  .then(() => closeDatabaseConnection())
  .then(() => process.exit(0))
  .catch((error) => {
    log.error('seed_failed', { error: error instanceof Error ? error.message : String(error) })
    process.exit(1)
  })
