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

import { OrderNotFoundError } from '@/shared/errors/OrderErrors'
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
    const order =
      params.status === ORDER_STATUS.CANCELLED
        ? await this.dependencies.orderRepository.cancelAndRestoreStock(params.orderId)
        : await this.dependencies.orderRepository.updateStatus(params.orderId, params.status)

    if (!order) throw new OrderNotFoundError(params.orderId)

    await this.dependencies.notificationQueue.add('order-status-changed', {
      orderId: order.id,
      status: order.status,
    })

    return { order }
  }
}
