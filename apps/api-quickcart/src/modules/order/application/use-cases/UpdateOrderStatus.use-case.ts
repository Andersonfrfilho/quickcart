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
import type { OrderStatusNotifier } from '@/modules/notification/domain/OrderStatusNotifier.interface'
import type { UpdateOrderStatusParams, UpdateOrderStatusResult } from '../types/UpdateOrderStatus.types'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

type UpdateOrderStatusUseCaseDependencies = {
  readonly orderRepository: OrderRepositoryInterface
  readonly orderStatusNotifier: OrderStatusNotifier
}

const useCaseLog = logger.child('UpdateOrderStatus')

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

/**
     * "Separado" afirma que a separação terminou — então os itens ficam marcados.
     *
     * Sem isto, avançar o status pelo botão da lista (que é como a maioria dos pedidos anda) deixava a
     * tela se contradizendo: a esteira dizia "Separado" e a lista de itens dizia "0/2 separados · 0%".
     * Foi assim que o defeito apareceu num pedido real.
     *
     * Item em falta fica de fora — quem aplica essa parte é o repositório, e é onde ela pertence.
     * Falhar aqui não desfaz a transição: o status já é verdade, e o pior caso é a contagem ficar
     * atrasada até alguém marcar à mão.
     */
    if (params.status === ORDER_STATUS.SEPARATED) {
      try {
        await this.dependencies.orderRepository.setAllItemsPicked({ orderId: params.orderId, picked: true })
      } catch (error: unknown) {
        useCaseLog.warn('items_not_marked_picked', { orderId: params.orderId, error: serializeError(error) })
      }
    }

    await this.dependencies.orderStatusNotifier.notifyStatusChanged({
      orderId: order.id,
      customerId: order.customerId,
      shortCode: order.shortCode,
      status: order.status,
    })

    return { order }
  }
}
