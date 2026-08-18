/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Classificador da spec §3.2: auto (confiante e com folga do 2º colocado),
 * ambíguo (inclui o caso de 1 único candidato "morno") e not_found (nada
 * acima do piso de relevância).
 */

import { describe, expect, test } from 'bun:test'
import type {
  CreateProductRecordParams,
  ListProductsRepositoryParams,
  ListProductsRepositoryResult,
  ProductRepositoryInterface,
  ProductSearchResult,
  UpdateProductRecordParams,
} from '@/modules/catalog/domain/ProductRepository.interface'
import type { Product } from '@/infra/database/schema'
import { MATCH_TYPE } from '@/modules/conversation/shared/Matcher.constant'
import { MatchProductsUseCase } from './MatchProducts.use-case'

class FakeProductRepository implements ProductRepositoryInterface {
  readonly searchCalls: { term: string; limit: number }[] = []

  constructor(private readonly searchResults: ProductSearchResult[]) {}

  async create(): Promise<Product> {
    throw new Error('not implemented in fake')
  }

  async update(_id: string, _params: UpdateProductRecordParams): Promise<Product> {
    throw new Error('not implemented in fake')
  }

  async findById(): Promise<Product | undefined> {
    throw new Error('not implemented in fake')
  }

  async findByBarcode(): Promise<Product | undefined> {
    throw new Error('not implemented in fake')
  }

  async adjustStock(): Promise<Product | undefined> {
    throw new Error('not implemented in fake')
  }

  async list(_params: ListProductsRepositoryParams): Promise<ListProductsRepositoryResult> {
    throw new Error('not implemented in fake')
  }

  async findSubstituteCandidate(): Promise<ProductSearchResult | undefined> {
    return undefined
  }

  async searchByTerm(term: string, limit: number): Promise<ProductSearchResult[]> {
    this.searchCalls.push({ term, limit })
    return this.searchResults
  }
}

function buildCandidate(overrides: Partial<ProductSearchResult>): ProductSearchResult {
  return {
    id: 'product-1',
    name: 'Produto',
    brand: null,
    unitSize: null,
    priceInCents: 100,
    score: 0.9,
    ...overrides,
  }
}

const item = { term: 'arroz', quantity: 1, unit: 'un' } as const

describe('MatchProductsUseCase', () => {
  test('candidato único com alta confiança e sem 2º colocado → auto', async () => {
    const repository = new FakeProductRepository([buildCandidate({ id: 'p1', score: 0.9 })])
    const useCase = new MatchProductsUseCase(repository)

    const result = await useCase.execute({ item })

    expect(result.matchType).toBe(MATCH_TYPE.AUTO)
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]?.productId).toBe('p1')
  })

  test('top1 confiante com folga suficiente do top2 → auto', async () => {
    const repository = new FakeProductRepository([
      buildCandidate({ id: 'p1', score: 0.9 }),
      buildCandidate({ id: 'p2', score: 0.5 }),
    ])
    const useCase = new MatchProductsUseCase(repository)

    const result = await useCase.execute({ item })

    expect(result.matchType).toBe(MATCH_TYPE.AUTO)
    expect(result.candidates).toEqual([expect.objectContaining({ productId: 'p1' })])
  })

  test('top1 acima do limiar de confiança mas sem folga do top2 → ambíguo', async () => {
    const repository = new FakeProductRepository([
      buildCandidate({ id: 'p1', score: 0.6 }),
      buildCandidate({ id: 'p2', score: 0.55 }),
    ])
    const useCase = new MatchProductsUseCase(repository)

    const result = await useCase.execute({ item })

    expect(result.matchType).toBe(MATCH_TYPE.AMBIGUOUS)
    expect(result.candidates).toHaveLength(2)
  })

  test('vários candidatos morno (abaixo do limiar de auto) → ambíguo', async () => {
    const repository = new FakeProductRepository([
      buildCandidate({ id: 'p1', score: 0.45 }),
      buildCandidate({ id: 'p2', score: 0.4 }),
      buildCandidate({ id: 'p3', score: 0.35 }),
    ])
    const useCase = new MatchProductsUseCase(repository)

    const result = await useCase.execute({ item })

    expect(result.matchType).toBe(MATCH_TYPE.AMBIGUOUS)
    expect(result.candidates.map((candidate) => candidate.productId)).toEqual(['p1', 'p2', 'p3'])
  })

  test('candidato único morno (entre o piso e o limiar de auto) → ambíguo, não not_found', async () => {
    const repository = new FakeProductRepository([buildCandidate({ id: 'p1', score: 0.4 })])
    const useCase = new MatchProductsUseCase(repository)

    const result = await useCase.execute({ item })

    expect(result.matchType).toBe(MATCH_TYPE.AMBIGUOUS)
    expect(result.candidates).toHaveLength(1)
  })

  test('nenhum candidato acima do piso de relevância → not_found', async () => {
    const repository = new FakeProductRepository([
      buildCandidate({ id: 'p1', score: 0.29 }),
      buildCandidate({ id: 'p2', score: 0.1 }),
    ])
    const useCase = new MatchProductsUseCase(repository)

    const result = await useCase.execute({ item })

    expect(result.matchType).toBe(MATCH_TYPE.NOT_FOUND)
    expect(result.candidates).toEqual([])
  })

  test('nenhum resultado de busca → not_found', async () => {
    const repository = new FakeProductRepository([])
    const useCase = new MatchProductsUseCase(repository)

    const result = await useCase.execute({ item })

    expect(result.matchType).toBe(MATCH_TYPE.NOT_FOUND)
    expect(result.candidates).toEqual([])
  })

  test('candidatos abaixo do piso são excluídos da lista de ambíguos', async () => {
    const repository = new FakeProductRepository([
      buildCandidate({ id: 'p1', score: 0.4 }),
      buildCandidate({ id: 'p2', score: 0.29 }),
    ])
    const useCase = new MatchProductsUseCase(repository)

    const result = await useCase.execute({ item })

    expect(result.candidates.map((candidate) => candidate.productId)).toEqual(['p1'])
  })

  test('busca no repositório usa o termo do item e o teto de candidatos', async () => {
    const repository = new FakeProductRepository([buildCandidate({ score: 0.9 })])
    const useCase = new MatchProductsUseCase(repository)

    await useCase.execute({ item: { term: 'feijao carioca', quantity: 1, unit: 'un' } })

    expect(repository.searchCalls).toEqual([{ term: 'feijao carioca', limit: 10 }])
  })
})
