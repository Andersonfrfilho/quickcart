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

import { paginateRows } from '@/modules/conversation/application/handlers/support/paginateRows'

describe('paginateRows', () => {
  it('devolve a primeira página e sinaliza que há próxima quando sobra item', () => {
    const result = paginateRows({ items: [1, 2, 3, 4, 5], page: 1, itemsPerPage: 2 })

    expect(result.pageItems).toEqual([1, 2])
    expect(result.hasNextPage).toBe(true)
  })

  it('devolve a última página sem próxima', () => {
    const result = paginateRows({ items: [1, 2, 3, 4, 5], page: 3, itemsPerPage: 2 })

    expect(result.pageItems).toEqual([5])
    expect(result.hasNextPage).toBe(false)
  })

  it('trata página menor que 1 como a primeira', () => {
    const result = paginateRows({ items: [1, 2, 3], page: 0, itemsPerPage: 2 })

    expect(result.pageItems).toEqual([1, 2])
  })

  it('não sinaliza próxima página quando tudo cabe numa só', () => {
    const result = paginateRows({ items: [1, 2], page: 1, itemsPerPage: 5 })

    expect(result.pageItems).toEqual([1, 2])
    expect(result.hasNextPage).toBe(false)
  })

  it('não sinaliza página anterior na primeira página', () => {
    const result = paginateRows({ items: [1, 2, 3, 4, 5], page: 1, itemsPerPage: 2 })

    expect(result.hasPreviousPage).toBe(false)
  })

  it('sinaliza página anterior a partir da segunda página', () => {
    const result = paginateRows({ items: [1, 2, 3, 4, 5], page: 2, itemsPerPage: 2 })

    expect(result.hasPreviousPage).toBe(true)
  })

  it('ida e volta bate no mesmo slice: avançar e voltar devolve os mesmos itens da página original', () => {
    const items = [1, 2, 3, 4, 5, 6, 7]
    const itemsPerPage = 3

    const firstPage = paginateRows({ items, page: 1, itemsPerPage })
    const secondPage = paginateRows({ items, page: 2, itemsPerPage })
    const backToFirstPage = paginateRows({ items, page: 1, itemsPerPage })

    expect(secondPage.hasPreviousPage).toBe(true)
    expect(backToFirstPage.pageItems).toEqual(firstPage.pageItems)
  })

  it('todo item é alcançável exatamente uma vez percorrendo todas as páginas', () => {
    const items = [1, 2, 3, 4, 5, 6, 7]
    const itemsPerPage = 3

    const seen: number[] = []
    for (let page = 1; page <= 3; page += 1) {
      seen.push(...paginateRows({ items, page, itemsPerPage }).pageItems)
    }

    expect(seen).toEqual(items)
  })
})
