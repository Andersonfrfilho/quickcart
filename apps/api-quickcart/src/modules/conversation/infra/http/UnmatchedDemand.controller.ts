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
import type { UnmatchedDemandRepositoryInterface } from '@/modules/conversation/domain/UnmatchedDemandRepository.interface'

/** Teto do que a rota devolve. Relatório é para decidir compra, não para exportar base. */
const MAX_LIMIT = 100
const DEFAULT_LIMIT = 30

/** Janela padrão: demanda de meses atrás já foi atendida por outra loja. */
const DEFAULT_WINDOW_DAYS = 90

const listUnmatchedDemandsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(MAX_LIMIT).default(DEFAULT_LIMIT),
  windowDays: z.coerce.number().int().positive().max(365).default(DEFAULT_WINDOW_DAYS),
})

export type UnmatchedDemandControllerDependencies = {
  readonly unmatchedDemandRepository: UnmatchedDemandRepositoryInterface
}

export class UnmatchedDemandController {
  constructor(private readonly dependencies: UnmatchedDemandControllerDependencies) {}

  handleListAdmin: RouteHandler = async (request, response) => {
    requireAdminToken(request)

    const { limit, windowDays } = validateQuery(listUnmatchedDemandsQuerySchema, request.query)
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

    const items = await this.dependencies.unmatchedDemandRepository.listSummary({ limit, since })

    response.json(200, {
      data: items.map((item) => ({
        term: item.term,
        lastRawTerm: item.lastRawTerm,
        requestCount: item.requestCount,
        customerCount: item.customerCount,
        lastRequestedAt: item.lastRequestedAt.toISOString(),
      })),
      // Ecoa a janela: sem isto, "3 pedidos" na tela não diz 3 pedidos em quanto tempo.
      meta: { windowDays, since: since.toISOString() },
    })
  }
}
