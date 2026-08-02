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
  /**
   * A loja VENDE, o cliente pediu, e acabou na hora de separar.
   *
   * Motivo próprio porque a decisão é outra: aqui não falta produto no catálogo, falta reposição — e
   * misturar com "não temos isso" faria o lojista comprar novidade quando o problema é o giro do que
   * ele já vende.
   */
  OUT_OF_STOCK: 'out_of_stock',
} as const

export type UnmatchedDemandSource = (typeof UNMATCHED_DEMAND_SOURCE)[keyof typeof UNMATCHED_DEMAND_SOURCE]

export const UNMATCHED_DEMAND_SOURCE_VALUES = Object.values(UNMATCHED_DEMAND_SOURCE) as [
  UnmatchedDemandSource,
  ...UnmatchedDemandSource[],
]

/**
 * Por onde o relatório pode ser ordenado.
 *
 * `term` entra na lista porque, depois de decidir o que comprar, o lojista volta à tela para conferir
 * item por item — e para conferir uma lista de trinta linhas a ordem alfabética é a única que ajuda.
 */
export const UNMATCHED_DEMAND_SORTABLE_FIELDS = ['customerCount', 'requestCount', 'lastRequestedAt', 'term'] as const
export type UnmatchedDemandSortableField = (typeof UNMATCHED_DEMAND_SORTABLE_FIELDS)[number]

export type UnmatchedDemandSortDirection = 'asc' | 'desc'

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
  /**
   * Todas as origens em que este termo apareceu na janela.
   *
   * Conjunto e não valor único porque a agregação é por termo: "arroz" pode ter faltado no catálogo em
   * março e acabado no estoque em maio. Sem expor isso, o lojista lê a linha sem saber se a decisão é
   * cadastrar produto ou repor prateleira — que são orçamentos diferentes.
   */
  readonly sources: readonly UnmatchedDemandSource[]
}

export type ListUnmatchedDemandsParams = {
  readonly limit: number
  /** Só o que foi pedido a partir desta data. Ausente = desde sempre. */
  readonly since?: Date | undefined
  /**
   * Filtra as LINHAS antes de agrupar, e não os grupos depois.
   *
   * Consequência intencional: com o filtro ativo, as contagens passam a ser da origem escolhida. Filtrar
   * depois do agrupamento mostraria "5 clientes" numa linha em que só 1 pediu pelo motivo filtrado.
   */
  readonly sources?: readonly UnmatchedDemandSource[] | undefined
  /** Busca parcial no termo já normalizado — o chamador normaliza antes de mandar. */
  readonly search?: string | undefined
  readonly sortBy: UnmatchedDemandSortableField
  readonly sortDirection: UnmatchedDemandSortDirection
}

export type UnmatchedDemandRepositoryInterface = {
  record(params: RecordUnmatchedDemandsParams): Promise<void>
  listSummary(params: ListUnmatchedDemandsParams): Promise<UnmatchedDemandSummary[]>
}
