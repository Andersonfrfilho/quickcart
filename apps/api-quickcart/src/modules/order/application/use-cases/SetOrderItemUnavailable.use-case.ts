/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O item acabou, descoberto na hora de separar.
 *
 * É o acontecimento mais comum de uma loja de bairro e o produto não tinha resposta para ele: o item
 * seguia no pedido como se fosse entregue, o total continuava cobrando, e a saída era cancelar tudo ou
 * combinar por fora do sistema.
 *
 * Duas coisas acontecem aqui, e o AVISO ao cliente não é uma delas:
 *
 * 1. O item fica marcado e o total é refeito sem ele — cobrar pelo que não vai chegar é o pior erro
 *    possível, porque o cliente descobre no extrato.
 * 2. Entra no relatório de demanda com motivo próprio (`out_of_stock`). "Acabou" é diferente de "não
 *    vendemos": um pede reposição mais frequente, o outro pede produto novo na prateleira.
 *
 * Avisar o cliente é `NotifyUnavailableItems`, chamado quando quem separa termina de conferir. Mandar aqui
 * fazia uma mensagem por item, cada uma anunciando um total que a marcação seguinte já tornava velho — e
 * a loja não tinha como reler o recado antes de ele sair.
 */

import { OrderNotFoundError } from '@/shared/errors/OrderErrors'
import type { OrderDetail, OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import {
  UNMATCHED_DEMAND_SOURCE,
  type UnmatchedDemandRepositoryInterface,
} from '@/modules/conversation/domain/UnmatchedDemandRepository.interface'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const useCaseLog = logger.child('SetOrderItemUnavailable')

type SetOrderItemUnavailableDependencies = {
  readonly orderRepository: OrderRepositoryInterface
  readonly unmatchedDemandRepository?: UnmatchedDemandRepositoryInterface | undefined
}

export type SetOrderItemUnavailableParams = {
  readonly orderId: string
  readonly itemId: string
  readonly unavailable: boolean
}

export class SetOrderItemUnavailableUseCase {
  constructor(private readonly dependencies: SetOrderItemUnavailableDependencies) {}

  async execute(params: SetOrderItemUnavailableParams): Promise<OrderDetail> {
    const before = await this.dependencies.orderRepository.findDetailById(params.orderId)
    if (!before) throw new OrderNotFoundError(params.orderId)

    const item = before.items.find((candidate) => candidate.id === params.itemId)
    if (!item) throw new OrderNotFoundError(params.orderId)

    const detail = await this.dependencies.orderRepository.setItemUnavailable(params)
    if (!detail) throw new OrderNotFoundError(params.orderId)

    // Desmarcar é correção de engano de quem separa: refaz o total e pronto, sem registrar demanda — o
    // item nunca faltou de verdade.
    if (!params.unavailable) return detail

    await this.recordDemand(detail, item.productName)

    return detail
  }

  private async recordDemand(detail: OrderDetail, productName: string): Promise<void> {
    try {
      await this.dependencies.unmatchedDemandRepository?.record({
        terms: [productName],
        customerId: detail.order.customerId,
        source: UNMATCHED_DEMAND_SOURCE.OUT_OF_STOCK,
      })
    } catch (error: unknown) {
      useCaseLog.warn('demand_not_recorded', { error: serializeError(error) })
    }
  }
}
