/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cancelamento é o único destino que precisa devolver estoque — por isso passa pelo caminho
 * transacional `cancelAndRestoreStock` em vez do `updateStatus` genérico.
 */

import { OrderInvalidStatusTransitionError, OrderNotFoundError } from '@/shared/errors/OrderErrors'
import { allowedNextStatuses, canTransitionTo } from '@/modules/order/domain/orderStatusFlow'
import { ORDER_STATUS } from '@/modules/order/shared/Order.constant'
import type { OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import type { JobQueue } from '@/modules/order/domain/JobQueue.interface'
import type { UpdateOrderStatusParams, UpdateOrderStatusResult } from '../types/UpdateOrderStatus.types'

type UpdateOrderStatusUseCaseDependencies = {
  readonly orderRepository: OrderRepositoryInterface
  readonly notificationQueue: JobQueue
}

export class UpdateOrderStatusUseCase {
  constructor(private readonly dependencies: UpdateOrderStatusUseCaseDependencies) {}

  async execute(params: UpdateOrderStatusParams): Promise<UpdateOrderStatusResult> {
    const current = await this.dependencies.orderRepository.findById(params.orderId)
    if (!current) throw new OrderNotFoundError(params.orderId)

    /**
     * A esteira é validada AQUI, não na tela.
     *
     * Enquanto a regra vivia só no frontend, a rota aceitava qualquer status do enum: aba velha, `curl` ou
     * duplo clique moviam pedido concluído de volta para "aguardando" — e cada transição manda mensagem ao
     * cliente, então o estrago saía da tela e chegava no WhatsApp de quem comprou.
     */
    const flow = { status: current.status, deliveryType: current.deliveryType }
    if (!canTransitionTo({ ...flow, nextStatus: params.status })) {
      throw new OrderInvalidStatusTransitionError({
        currentStatus: current.status,
        nextStatus: params.status,
        allowedNextStatuses: allowedNextStatuses(flow),
      })
    }

    const order =
      params.status === ORDER_STATUS.CANCELLED
        ? await this.dependencies.orderRepository.cancelAndRestoreStock(params.orderId)
        : // Condicionado ao status que acabou de ser validado: se alguém mudou nesse intervalo, nada casa.
          await this.dependencies.orderRepository.updateStatus(params.orderId, params.status, current.status)

    if (!order) {
      /**
       * Chegou aqui com o pedido existindo, então o `WHERE` do status é que não casou: outra pessoa mudou o
       * pedido entre a validação e a gravação. Erro de transição, e não "não encontrado" — quem clicou
       * precisa saber que a tela dele está velha.
       */
      const latest = await this.dependencies.orderRepository.findById(params.orderId)
      if (!latest) throw new OrderNotFoundError(params.orderId)

      throw new OrderInvalidStatusTransitionError({
        currentStatus: latest.status,
        nextStatus: params.status,
        allowedNextStatuses: allowedNextStatuses({ status: latest.status, deliveryType: latest.deliveryType }),
      })
    }

    await this.dependencies.notificationQueue.add('order-status-changed', {
      orderId: order.id,
      status: order.status,
    })

    return { order }
  }
}
