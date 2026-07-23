/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Quando `requesterPhone` é informado (consulta pública via WhatsApp/web), o pedido só é
 * devolvido se o telefone confere com o do cliente dono do pedido — evita vazar pedidos de
 * terceiros a partir de um shortCode adivinhado.
 */

import { OrderNotFoundError, OrderPhoneMismatchError } from '@/shared/errors/OrderErrors'
import type { OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import type { CustomerRepositoryInterface } from '@/modules/webhook/domain/CustomerRepository.interface'
import type { GetOrderByShortCodeParams, GetOrderByShortCodeResult } from '../types/GetOrderByShortCode.types'

type GetOrderByShortCodeUseCaseDependencies = {
  readonly orderRepository: OrderRepositoryInterface
  readonly customerRepository: CustomerRepositoryInterface
}

export class GetOrderByShortCodeUseCase {
  constructor(private readonly dependencies: GetOrderByShortCodeUseCaseDependencies) {}

  async execute(params: GetOrderByShortCodeParams): Promise<GetOrderByShortCodeResult> {
    const order = await this.dependencies.orderRepository.findByShortCode(params.shortCode)
    if (!order) throw new OrderNotFoundError(params.shortCode)

    if (params.requesterPhone) {
      const customer = await this.dependencies.customerRepository.findById(order.customerId)
      if (!customer || customer.phone !== params.requesterPhone) throw new OrderPhoneMismatchError()
    }

    const items = await this.dependencies.orderRepository.listItems(order.id)
    return { order, items }
  }
}
