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

import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import { CachedKnownBrandsProvider } from '@/modules/conversation/infra/providers/CachedKnownBrandsProvider'

function buildFakeRepository(params: { brands?: readonly string[]; error?: Error }): {
  readonly repository: ProductRepositoryInterface
  readonly callCount: () => number
} {
  let calls = 0

  const repository = {
    listDistinctBrands: async () => {
      calls += 1
      if (params.error) throw params.error
      return [...(params.brands ?? [])]
    },
  } as unknown as ProductRepositoryInterface

  return { repository, callCount: () => calls }
}

describe('CachedKnownBrandsProvider', () => {
  it('devolve as marcas do catálogo já normalizadas', async () => {
    const { repository } = buildFakeRepository({ brands: ['Broto Legal', 'AÇÚCAR União'] })
    const provider = new CachedKnownBrandsProvider(repository)

    const brands = await provider.listKnownBrands()

    expect(brands.has('broto legal')).toBe(true)
    expect(brands.has('acucar uniao')).toBe(true)
  })

  it('não bate no repositório de novo dentro do TTL do cache', async () => {
    const { repository, callCount } = buildFakeRepository({ brands: ['Broto Legal'] })
    const provider = new CachedKnownBrandsProvider(repository)

    await provider.listKnownBrands()
    await provider.listKnownBrands()

    expect(callCount()).toBe(1)
  })

  it('cai para um conjunto vazio, sem lançar, quando o repositório falha', async () => {
    const { repository } = buildFakeRepository({ error: new Error('catálogo indisponível') })
    const provider = new CachedKnownBrandsProvider(repository)

    const brands = await provider.listKnownBrands()

    expect(brands.size).toBe(0)
  })
})
