/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Carrega o catálogo de porte de mercado. Comando à parte do `db:seed` de propósito — ver o
 * cabeçalho de `CatalogBulkSeed.ts`.
 *
 * A deduplicação é feita UMA vez, em memória, e não com uma consulta por produto como no seed
 * curado: com doze mil itens seriam doze mil idas ao banco, e o `perPage: 200` daquele laço nem
 * enxergaria o catálogo inteiro para comparar.
 */

import { CreateProductUseCase } from '@/modules/catalog/application/use-cases/CreateProduct.use-case'
import { DrizzleCategoryRepository } from '@/modules/catalog/infra/database/DrizzleCategoryRepository'
import { DrizzleProductRepository } from '@/modules/catalog/infra/database/DrizzleProductRepository'
import { SEED_CATEGORIES } from '@/infra/database/seeds/CatalogSeedCategories'
import { CreateCategoryUseCase } from '@/modules/catalog/application/use-cases/CreateCategory.use-case'
import { buildBulkCatalog } from '@/infra/database/seeds/CatalogBulkSeed'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

import { closeDatabaseConnection } from './connection'

const log = logger.child('BulkCatalogSeed')
const PROGRESS_EVERY = 500
const EXISTING_PAGE_SIZE = 1000

/** Nome + marca é o que identifica um SKU aqui — a mesma chave que o seed curado compara. */
function keyOf(params: { name: string; brand: string | null }): string {
  return `${params.name}|${params.brand ?? ''}`
}

async function loadExistingKeys(productRepository: DrizzleProductRepository): Promise<Set<string>> {
  const keys = new Set<string>()
  for (let page = 1; ; page += 1) {
    const { items } = await productRepository.list({
      onlyAvailable: false,
      page,
      perPage: EXISTING_PAGE_SIZE,
      sortBy: 'name',
      sortDirection: 'asc',
    })
    for (const item of items) keys.add(keyOf(item))
    if (items.length < EXISTING_PAGE_SIZE) return keys
  }
}

async function run(): Promise<void> {
  const categoryRepository = new DrizzleCategoryRepository()
  const productRepository = new DrizzleProductRepository()
  const createCategoryUseCase = new CreateCategoryUseCase({ categoryRepository })
  const createProductUseCase = new CreateProductUseCase({ categoryRepository, productRepository })

  // As categorias vêm do seed curado: o catálogo de carga não inventa taxonomia própria.
  const existingCategories = await categoryRepository.list()
  const categoryIdByKey = new Map<string, string>()
  for (const seedCategory of SEED_CATEGORIES) {
    const found = existingCategories.find((category) => category.name === seedCategory.name)
    if (found) {
      categoryIdByKey.set(seedCategory.key, found.id)
      continue
    }
    const created = await createCategoryUseCase.execute({
      name: seedCategory.name,
      emoji: seedCategory.emoji,
      sortOrder: seedCategory.sortOrder,
    })
    categoryIdByKey.set(seedCategory.key, created.id)
  }

  const catalog = buildBulkCatalog()
  const existingKeys = await loadExistingKeys(productRepository)
  log.info('bulk_seed_started', { generated: catalog.length, alreadyInDatabase: existingKeys.size })

  let created = 0
  let skipped = 0

  for (const product of catalog) {
    if (existingKeys.has(keyOf({ name: product.name, brand: product.brand }))) {
      skipped += 1
      continue
    }

    const categoryId = categoryIdByKey.get(product.categoryKey)
    if (!categoryId) throw new Error(`Unknown category key: ${product.categoryKey}`)

    await createProductUseCase.execute({
      categoryId,
      name: product.name,
      brand: product.brand,
      unit: product.unit,
      unitSize: product.unitSize,
      priceInCents: product.priceInCents,
      stockQuantity: product.stockQuantity,
      isAvailable: true,
      aliases: product.aliases,
    })
    created += 1

    // Doze mil inserções levam minutos: sem sinal de vida, quem roda não sabe se travou.
    if (created % PROGRESS_EVERY === 0) log.info('bulk_seed_progress', { created, remaining: catalog.length - created - skipped })
  }

  log.info('bulk_seed_finished', { created, skipped, total: catalog.length })
}

run()
  .then(() => closeDatabaseConnection())
  .then(() => process.exit(0))
  .catch((error) => {
    log.error('bulk_seed_failed', { error: serializeError(error) })
    process.exit(1)
  })
