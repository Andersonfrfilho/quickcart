/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Relatório do que os clientes pediram e a loja não tinha.
 *
 * Só para admin: é uma leitura sobre o comportamento dos clientes, e agregada ela ainda diz quantas
 * pessoas distintas pediram cada item — número que não deve circular fora de quem opera a loja.
 *
 * Devolve termo agregado, nunca quem pediu. O lojista precisa decidir o que passar a vender, e para
 * isso o nome do cliente não acrescenta nada — só amplia o dado pessoal exposto numa tela de
 * relatório (LGPD, minimização).
 */

import { z } from 'zod'
import type { RouteHandler } from '@/infra/http/router'
import { requireAdminToken } from '@/infra/http/middlewares/requireAdminToken'
import { validateQuery } from '@/infra/http/middlewares/validateQuery'
import {
  UNMATCHED_DEMAND_SORTABLE_FIELDS,
  UNMATCHED_DEMAND_SOURCE_VALUES,
  type UnmatchedDemandRepositoryInterface,
} from '@/modules/conversation/domain/UnmatchedDemandRepository.interface'

/** Teto do que a rota devolve. Relatório é para decidir compra, não para exportar base. */
const MAX_LIMIT = 100
const DEFAULT_LIMIT = 30

/** Janela padrão: demanda de meses atrás já foi atendida por outra loja. */
const DEFAULT_WINDOW_DAYS = 90

/**
 * Clientes distintos, do maior para o menor: é o número que decide passar a vender, não o total de
 * pedidos. Dez pedidos de uma pessoa são um gosto pessoal; dez pessoas pedindo uma vez são prateleira
 * vazia. Mudar este padrão muda o que o lojista compra na primeira linha da tela.
 */
const DEFAULT_SORT_BY = 'customerCount'
const DEFAULT_SORT_DIRECTION = 'desc'

const MAX_SEARCH_LENGTH = 120

/**
 * Origens como lista separada por vírgula, como o resto dos filtros da API.
 *
 * `validateQuery` colapsa chaves repetidas (só a última sobrevive), então `?source=a&source=b` perderia
 * o primeiro valor em silêncio — o CSV é o que permite seleção múltipla de verdade.
 */
const sourceListSchema = z
  .string()
  .transform((value) => value.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0))
  .pipe(z.array(z.enum(UNMATCHED_DEMAND_SOURCE_VALUES)).nonempty())

const listUnmatchedDemandsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(MAX_LIMIT).default(DEFAULT_LIMIT),
  windowDays: z.coerce.number().int().positive().max(365).default(DEFAULT_WINDOW_DAYS),
  source: sourceListSchema.optional(),
  /** Busca parcial no termo; a normalização (minúscula, sem acento) acontece no repositório. */
  search: z.string().trim().min(1).max(MAX_SEARCH_LENGTH).optional(),
  sortBy: z.enum(UNMATCHED_DEMAND_SORTABLE_FIELDS).default(DEFAULT_SORT_BY),
  sortDirection: z.enum(['asc', 'desc']).default(DEFAULT_SORT_DIRECTION),
})

export type UnmatchedDemandControllerDependencies = {
  readonly unmatchedDemandRepository: UnmatchedDemandRepositoryInterface
}

export class UnmatchedDemandController {
  constructor(private readonly dependencies: UnmatchedDemandControllerDependencies) {}

  handleListAdmin: RouteHandler = async (request, response) => {
    requireAdminToken(request)

    const { limit, windowDays, source, search, sortBy, sortDirection } = validateQuery(
      listUnmatchedDemandsQuerySchema,
      request.query,
    )
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

    const items = await this.dependencies.unmatchedDemandRepository.listSummary({
      limit,
      since,
      sources: source,
      search,
      sortBy,
      sortDirection,
    })

    response.json(200, {
      data: items.map((item) => ({
        term: item.term,
        lastRawTerm: item.lastRawTerm,
        requestCount: item.requestCount,
        customerCount: item.customerCount,
        lastRequestedAt: item.lastRequestedAt.toISOString(),
        // O lojista precisa distinguir "não vendemos" de "acabou": a primeira decisão é cadastrar
        // produto, a segunda é repor — e a linha sem origem não diz qual das duas.
        sources: item.sources,
      })),
      // Ecoa a janela: sem isto, "3 pedidos" na tela não diz 3 pedidos em quanto tempo.
      meta: { windowDays, since: since.toISOString() },
    })
  }
}
