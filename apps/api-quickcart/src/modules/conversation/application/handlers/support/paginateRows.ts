/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Fatiamento de página compartilhado por toda lista interativa (resolução,
 * busca durante navegação, edição de carrinho): o chamador já desconta do
 * `itemsPerPage` a linha de "próxima página" e as demais linhas fixas da
 * seção (spec §4), então esta função só corta o slice e diz se sobrou algo.
 */

export type PaginateRowsParams<TItem> = {
  readonly items: readonly TItem[]
  /** 1-indexed. Qualquer valor menor que 1 é tratado como a primeira página. */
  readonly page: number
  readonly itemsPerPage: number
}

export type PaginateRowsResult<TItem> = {
  readonly pageItems: readonly TItem[]
  readonly hasNextPage: boolean
}

export function paginateRows<TItem>(params: PaginateRowsParams<TItem>): PaginateRowsResult<TItem> {
  const { items, page, itemsPerPage } = params
  const safePage = page > 0 ? page : 1
  const offset = (safePage - 1) * itemsPerPage

  return {
    pageItems: items.slice(offset, offset + itemsPerPage),
    hasNextPage: offset + itemsPerPage < items.length,
  }
}
