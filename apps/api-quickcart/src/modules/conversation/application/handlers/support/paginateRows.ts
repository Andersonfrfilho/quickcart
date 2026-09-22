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
 * `itemsPerPage` a linha de "próxima página", a de "página anterior" e as
 * demais linhas fixas da seção (spec §4), então esta função só corta o
 * slice e diz o que sobrou de cada lado.
 *
 * `itemsPerPage` é o MESMO em toda página, inclusive a primeira (que não
 * mostra "anterior") e a última (que não mostra "próxima") — a página
 * desperdiça a linha que não usa, mas em troca o offset vem de uma conta
 * só (`(page - 1) * itemsPerPage`), então ir e voltar bate sempre no mesmo
 * slice: round-trip é uma propriedade da fórmula, não algo que precisa ser
 * verificado chamada a chamada.
 */

export type PaginateRowsParams<TItem> = {
  readonly items: readonly TItem[]
  /** 1-indexed. Qualquer valor menor que 1 é tratado como a primeira página. */
  readonly page: number
  /** Já deve descontar toda linha fixa da seção, inclusive "anterior" e "próxima" reservadas. */
  readonly itemsPerPage: number
}

export type PaginateRowsResult<TItem> = {
  readonly pageItems: readonly TItem[]
  readonly hasNextPage: boolean
  readonly hasPreviousPage: boolean
}

export function paginateRows<TItem>(params: PaginateRowsParams<TItem>): PaginateRowsResult<TItem> {
  const { items, page, itemsPerPage } = params
  const safePage = page > 0 ? page : 1
  const offset = (safePage - 1) * itemsPerPage

  return {
    pageItems: items.slice(offset, offset + itemsPerPage),
    hasNextPage: offset + itemsPerPage < items.length,
    hasPreviousPage: safePage > 1,
  }
}
