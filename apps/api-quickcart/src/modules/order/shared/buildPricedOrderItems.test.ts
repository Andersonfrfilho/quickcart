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

import type { Product } from '@/infra/database/schema'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import { buildPricedOrderItems } from './buildPricedOrderItems'

function produto(id: string, priceInCents: number, isAvailable = true): Product {
  return { id, name: `Produto ${id}`, priceInCents, isAvailable } as Product
}

/** Conta as idas ao banco: é o que a cotação pública precisa manter em uma. */
function repositorioContando(catalogo: readonly Product[]) {
  const chamadas = { findById: 0, findByIds: 0 }
  const repository = {
    async findById(id: string) {
      chamadas.findById += 1
      return catalogo.find((item) => item.id === id)
    },
    async findByIds(ids: readonly string[]) {
      chamadas.findByIds += 1
      return catalogo.filter((item) => ids.includes(item.id))
    },
  } as unknown as ProductRepositoryInterface
  return { repository, chamadas }
}

describe('buildPricedOrderItems', () => {
  it('faz UMA consulta para todos os itens, e nenhuma por item', async () => {
    const catalogo = Array.from({ length: 50 }, (_, index) => produto(`p${index}`, 100 + index))
    const { repository, chamadas } = repositorioContando(catalogo)

    await buildPricedOrderItems(
      repository,
      catalogo.map((item) => ({ productId: item.id, quantity: 1 })),
    )

    expect(chamadas).toEqual({ findById: 0, findByIds: 1 })
  })

  it('preço vem do banco, e o produto repetido não gera consulta a mais', async () => {
    const { repository, chamadas } = repositorioContando([produto('a', 250)])

    const items = await buildPricedOrderItems(repository, [
      { productId: 'a', quantity: 2 },
      { productId: 'a', quantity: 1 },
    ])

    expect(items.map((item) => item.totalInCents)).toEqual([500, 250])
    expect(chamadas.findByIds).toBe(1)
  })

  it('mantém a ordem pedida, mesmo que o banco devolva em outra', async () => {
    const { repository } = repositorioContando([produto('b', 2), produto('a', 1)])

    const items = await buildPricedOrderItems(repository, [
      { productId: 'a', quantity: 1 },
      { productId: 'b', quantity: 1 },
    ])

    expect(items.map((item) => item.productId)).toEqual(['a', 'b'])
  })

  it('recusa produto inexistente e produto indisponível', async () => {
    const { repository } = repositorioContando([produto('a', 1, false)])

    expect(buildPricedOrderItems(repository, [{ productId: 'nao-existe', quantity: 1 }])).rejects.toThrow()
    expect(buildPricedOrderItems(repository, [{ productId: 'a', quantity: 1 }])).rejects.toThrow()
  })
})
