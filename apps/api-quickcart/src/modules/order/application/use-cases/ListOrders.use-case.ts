/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import type { ListOrdersParams, ListOrdersResult } from '../types/ListOrders.types'

type ListOrdersUseCaseDependencies = {
  readonly orderRepository: OrderRepositoryInterface
}

export class ListOrdersUseCase {
  constructor(private readonly dependencies: ListOrdersUseCaseDependencies) {}

  async execute(params: ListOrdersParams): Promise<ListOrdersResult> {
    const { items, total } = await this.dependencies.orderRepository.list(params)
    return { items, total, page: params.page, perPage: params.perPage }
  }
}
