/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { describe, expect, it } from 'bun:test'

import type { Customer } from '@/infra/database/schema/customers'
import type {
  ListOrdersRepositoryParams,
  ListOrdersRepositoryResult,
  OrderRepositoryInterface,
} from '@/modules/order/domain/OrderRepository.interface'
import type { CustomerRepositoryInterface } from '@/modules/webhook/domain/CustomerRepository.interface'

import { ListMyOrdersUseCase } from './ListMyOrders.use-case'

const USER_ID = '66666666-6666-4666-8666-666666666666'
const CUSTOMER_ID = '77777777-7777-4777-8777-777777777777'

function buildCustomerRepository(customer: Customer | undefined): CustomerRepositoryInterface {
  return { async findByUserId() { return customer } } as unknown as CustomerRepositoryInterface
}

function buildOrderRepository(received: ListOrdersRepositoryParams[]): OrderRepositoryInterface {
  return {
    async list(params: ListOrdersRepositoryParams): Promise<ListOrdersRepositoryResult> {
      received.push(params)
      return { items: [], total: 0 }
    },
  } as unknown as OrderRepositoryInterface
}

const customer = {
  id: CUSTOMER_ID,
  phone: '11999998888',
  name: 'Pessoa',
  email: null,
  userId: USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies Customer

describe('ListMyOrdersUseCase', () => {
  it('filtra pelo cliente do token — o dono nunca vem da requisição', async () => {
    const received: ListOrdersRepositoryParams[] = []

    await new ListMyOrdersUseCase({
      orderRepository: buildOrderRepository(received),
      customerRepository: buildCustomerRepository(customer),
    }).execute({ userId: USER_ID, page: 1, perPage: 20 })

    expect(received).toHaveLength(1)
    expect(received[0]?.customerId).toBe(CUSTOMER_ID)
  })

  it('login que ainda não comprou recebe lista vazia, e não consulta pedido nenhum', async () => {
    const received: ListOrdersRepositoryParams[] = []

    const result = await new ListMyOrdersUseCase({
      orderRepository: buildOrderRepository(received),
      customerRepository: buildCustomerRepository(undefined),
    }).execute({ userId: USER_ID, page: 1, perPage: 20 })

    expect(result).toEqual({ items: [], total: 0, page: 1, perPage: 20 })
    // Sem cliente não há o que filtrar: consultar sem `customerId` traria a fila inteira da loja.
    expect(received).toEqual([])
  })
})
