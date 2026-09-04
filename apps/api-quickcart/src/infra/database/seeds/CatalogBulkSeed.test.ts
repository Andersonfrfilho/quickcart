/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { describe, expect, it } from 'bun:test'

import { buildBulkCatalog } from './CatalogBulkSeed'
import { SEED_CATEGORIES } from './CatalogSeedCategories'

const catalog = buildBulkCatalog()

describe('catálogo de carga', () => {
  it('tem porte de mercado de verdade', () => {
    expect(catalog.length).toBeGreaterThanOrEqual(12_000)
  })

  it('nome + marca é único: SKU repetido viraria linha duplicada na prateleira', () => {
    const keys = new Set(catalog.map((product) => `${product.name}|${product.brand}`))

    expect(keys.size).toBe(catalog.length)
  })

  it('é determinístico — rodar duas vezes dá exatamente o mesmo catálogo', () => {
    const again = buildBulkCatalog()

    expect(again.map((p) => `${p.name}|${p.brand}|${p.priceInCents}|${p.stockQuantity}`)).toEqual(
      catalog.map((p) => `${p.name}|${p.brand}|${p.priceInCents}|${p.stockQuantity}`),
    )
  })

  it('a embalagem combina com a unidade — queijo não se vende em mililitro', () => {
    const SUFFIX_BY_UNIT: Readonly<Record<string, RegExp>> = {
      g: /(g|kg)$/,
      kg: /(g|kg)$/,
      ml: /(ml|L)$/,
      un: /^(unidade|pacote|fardo)/,
    }

    const wrong = catalog.filter((product) => !SUFFIX_BY_UNIT[product.unit]?.test(product.unitSize))

    expect(wrong.slice(0, 3)).toEqual([])
  })

  it('só usa categorias que o seed curado cria — nada de taxonomia inventada', () => {
    const known = new Set(SEED_CATEGORIES.map((category) => category.key))
    const unknown = [...new Set(catalog.map((p) => p.categoryKey))].filter((key) => !known.has(key))

    expect(unknown).toEqual([])
  })

  it('todo produto tem preço positivo, estoque e ao menos um alias para a busca achar', () => {
    const broken = catalog.filter(
      (product) => product.priceInCents <= 0 || product.stockQuantity < 0 || product.aliases.length === 0,
    )

    expect(broken.slice(0, 3)).toEqual([])
  })
})
