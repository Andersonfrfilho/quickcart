/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * "Meus pedidos": a lista da PESSOA que está logada.
 *
 * O dono sai do token, nunca de um campo da requisição — `security.md` §2 e o BOLA da OWASP: aceitar
 * `customerId` do cliente seria entregar o histórico alheio a quem trocasse o número na URL.
 */

import type { OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import type { CustomerRepositoryInterface } from '@/modules/webhook/domain/CustomerRepository.interface'
import type { ListOrdersResult } from '@/modules/order/application/types/ListOrders.types'

type ListMyOrdersUseCaseDependencies = {
  readonly orderRepository: OrderRepositoryInterface
  readonly customerRepository: CustomerRepositoryInterface
}

export type ListMyOrdersParams = {
  readonly userId: string
  readonly page: number
  readonly perPage: number
}

export class ListMyOrdersUseCase {
  constructor(private readonly dependencies: ListMyOrdersUseCaseDependencies) {}

  async execute(params: ListMyOrdersParams): Promise<ListOrdersResult> {
    const customer = await this.dependencies.customerRepository.findByUserId(params.userId)

    // Login que ainda não comprou: lista vazia, não 404 — a tela desenha o estado "nenhum pedido".
    if (!customer) return { items: [], total: 0, page: params.page, perPage: params.perPage }

    const { items, total } = await this.dependencies.orderRepository.list({
      customerId: customer.id,
      page: params.page,
      perPage: params.perPage,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    })

    return { items, total, page: params.page, perPage: params.perPage }
  }
}
