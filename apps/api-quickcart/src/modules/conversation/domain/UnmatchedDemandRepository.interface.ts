/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

/** De onde veio o pedido sem resposta — separa "não achei nada" de "achei e o cliente recusou". */
export const UNMATCHED_DEMAND_SOURCE = {
  /** O catálogo não tem nada parecido. Falta de produto. */
  LIST: 'list',
  /** Havia candidatos e o cliente respondeu "nenhum desses". Falta do produto CERTO. */
  RESOLUTION_SKIPPED: 'resolution_skipped',
} as const

export type UnmatchedDemandSource = (typeof UNMATCHED_DEMAND_SOURCE)[keyof typeof UNMATCHED_DEMAND_SOURCE]

export type RecordUnmatchedDemandsParams = {
  readonly terms: readonly string[]
  readonly customerId: string | null
  readonly source: UnmatchedDemandSource
}

export type UnmatchedDemandSummary = {
  readonly term: string
  /** Como os clientes falaram, exemplo mais recente: é a palavra que o catálogo deveria reconhecer. */
  readonly lastRawTerm: string
  readonly requestCount: number
  /**
   * Clientes DISTINTOS que pediram.
   *
   * É este número que decide passar a vender, não o total: dez pedidos de uma pessoa são um gosto
   * pessoal, dez pessoas pedindo uma vez são uma prateleira vazia.
   */
  readonly customerCount: number
  readonly lastRequestedAt: Date
}

export type ListUnmatchedDemandsParams = {
  readonly limit: number
  /** Só o que foi pedido a partir desta data. Ausente = desde sempre. */
  readonly since?: Date | undefined
}

export type UnmatchedDemandRepositoryInterface = {
  record(params: RecordUnmatchedDemandsParams): Promise<void>
  listSummary(params: ListUnmatchedDemandsParams): Promise<UnmatchedDemandSummary[]>
}
