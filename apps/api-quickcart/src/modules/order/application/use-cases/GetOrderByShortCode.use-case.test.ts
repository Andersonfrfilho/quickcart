/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Unit test com fakes em memória — cobre a busca pública por shortCode, incluindo o
 * guard anti-enumeração (o telefone do solicitante precisa bater com o dono do pedido).
 */

import { describe, expect, test } from 'bun:test'
import { OrderNotFoundError, OrderPhoneMismatchError } from '@/shared/errors/OrderErrors'
import type {
  CustomerRepositoryInterface,
  UpdateContactInfoParams,
  UpsertCustomerByPhoneParams,
} from '@/modules/webhook/domain/CustomerRepository.interface'
import type { OrderItemRecord, OrderRecord, OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import type { Customer } from '@/infra/database/schema'
import { GetOrderByShortCodeUseCase } from './GetOrderByShortCode.use-case'

class FakeCustomerRepository implements CustomerRepositoryInterface {
  constructor(private readonly customers: Map<string, Customer>) {}

  async findById(id: string): Promise<Customer | undefined> {
    return this.customers.get(id)
  }

  async findByPhone(): Promise<Customer | undefined> {
    return undefined
  }

  async upsertByPhone(params: UpsertCustomerByPhoneParams): Promise<Customer> {
    return { id: 'customer-1', phone: params.phone, name: params.name ?? null, email: null, defaultAddress: null, createdAt: new Date(), updatedAt: new Date() }
  }

  async updateContactInfo(params: UpdateContactInfoParams): Promise<Customer> {
    return {
      id: params.customerId,
      phone: '',
      name: null,
      email: params.email ?? null,
      defaultAddress: params.defaultAddress ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }
}

class FakeOrderRepository implements OrderRepositoryInterface {
  readonly orders = new Map<string, OrderRecord>()
  readonly itemsByOrder = new Map<string, OrderItemRecord[]>()

  async createWithStockDecrement(): ReturnType<OrderRepositoryInterface['createWithStockDecrement']> {
    throw new Error('not implemented')
  }

  async findById(id: string): Promise<OrderRecord | undefined> {
    return this.orders.get(id)
  }

  async findByShortCode(shortCode: string): Promise<OrderRecord | undefined> {
    return [...this.orders.values()].find((order) => order.shortCode === shortCode)
  }

  async findLastByCustomer(): Promise<OrderRecord | undefined> {
    return undefined
  }

  async listRecentByCustomer(customerId: string, limit: number): Promise<OrderRecord[]> {
    return [...this.orders.values()].filter((order) => order.customerId === customerId).slice(0, limit)
  }

  async findDetailById(id: string) {
    const order = this.orders.get(id)
    // O fake não guarda cliente: os testes deste caso de uso não passam pelo detalhe.
    return order ? { order: { ...order, customerName: null, customerPhone: '' }, items: [] } : undefined
  }

  async setItemUnavailable(params: { orderId: string; itemId: string; unavailable: boolean }) {
    // O fake não guarda item: os testes deste caso de uso não passam por falta de produto.
    return this.findDetailById(params.orderId)
  }

  async listItems(orderId: string): Promise<OrderItemRecord[]> {
    return this.itemsByOrder.get(orderId) ?? []
  }

  async list(): ReturnType<OrderRepositoryInterface['list']> {
    return { items: [], total: 0 }
  }

  async updateStatus(): Promise<OrderRecord | undefined> {
    return undefined
  }

  async cancelAndRestoreStock(): Promise<OrderRecord | undefined> {
    return undefined
  }
}

function buildOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: 'order-1',
    shortCode: 'QC-1000',
    customerId: 'customer-1',
    cartId: null,
    channel: 'web',
    status: 'pending_confirmation',
    totalInCents: 5000,
    deliveryType: 'delivery',
    address: null,
    paymentMethod: 'pix',
    receiptPreference: 'email',
    fiscalDocumentId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('GetOrderByShortCodeUseCase', () => {
  test('retorna pedido e itens quando não há verificação de telefone', async () => {
    const orderRepository = new FakeOrderRepository()
    const order = buildOrder()
    orderRepository.orders.set(order.id, order)
    orderRepository.itemsByOrder.set(order.id, [])
    const customerRepository = new FakeCustomerRepository(new Map())
    const useCase = new GetOrderByShortCodeUseCase({ orderRepository, customerRepository })

    const result = await useCase.execute({ shortCode: 'QC-1000' })

    expect(result.order).toEqual(order)
    expect(result.items).toEqual([])
  })

  test('retorna pedido quando o telefone do solicitante confere com o dono', async () => {
    const orderRepository = new FakeOrderRepository()
    const order = buildOrder()
    orderRepository.orders.set(order.id, order)
    orderRepository.itemsByOrder.set(order.id, [])
    const customer: Customer = {
      id: 'customer-1',
      phone: '5511999999999',
      name: 'Maria',
      email: null,
      defaultAddress: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const customerRepository = new FakeCustomerRepository(new Map([[customer.id, customer]]))
    const useCase = new GetOrderByShortCodeUseCase({ orderRepository, customerRepository })

    const result = await useCase.execute({ shortCode: 'QC-1000', requesterPhone: '5511999999999' })

    expect(result.order).toEqual(order)
  })

  test('lança OrderPhoneMismatchError quando o telefone do solicitante não confere', async () => {
    const orderRepository = new FakeOrderRepository()
    const order = buildOrder()
    orderRepository.orders.set(order.id, order)
    orderRepository.itemsByOrder.set(order.id, [])
    const customer: Customer = {
      id: 'customer-1',
      phone: '5511999999999',
      name: 'Maria',
      email: null,
      defaultAddress: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const customerRepository = new FakeCustomerRepository(new Map([[customer.id, customer]]))
    const useCase = new GetOrderByShortCodeUseCase({ orderRepository, customerRepository })

    await expect(useCase.execute({ shortCode: 'QC-1000', requesterPhone: '5511888888888' })).rejects.toBeInstanceOf(
      OrderPhoneMismatchError,
    )
  })

  test('lança OrderNotFoundError quando o shortCode não existe', async () => {
    const orderRepository = new FakeOrderRepository()
    const customerRepository = new FakeCustomerRepository(new Map())
    const useCase = new GetOrderByShortCodeUseCase({ orderRepository, customerRepository })

    await expect(useCase.execute({ shortCode: 'QC-9999' })).rejects.toBeInstanceOf(OrderNotFoundError)
  })
})
