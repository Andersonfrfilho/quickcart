/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Unit test com fakes em memória — cobre a atualização normal de status, o cancelamento
 * (que precisa devolver o estoque via cancelAndRestoreStock) e pedido inexistente.
 */

import { describe, expect, test } from 'bun:test'
import { OrderNotFoundError } from '@/shared/errors/OrderErrors'
import { ORDER_STATUS } from '@/modules/order/shared/Order.constant'
import type { OrderItemRecord, OrderRecord, OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import type { JobQueue } from '@/modules/order/domain/JobQueue.interface'
import { UpdateOrderStatusUseCase } from './UpdateOrderStatus.use-case'

class FakeOrderRepository implements OrderRepositoryInterface {
  readonly orders = new Map<string, OrderRecord>()
  readonly itemsByOrder = new Map<string, OrderItemRecord[]>()
  readonly stockRestoredCalls: string[] = []

  constructor(private readonly stock: Map<string, number>) {}

  async createWithStockDecrement(): ReturnType<OrderRepositoryInterface['createWithStockDecrement']> {
    throw new Error('not implemented')
  }

  async findById(id: string): Promise<OrderRecord | undefined> {
    return this.orders.get(id)
  }

  async findByShortCode(): Promise<OrderRecord | undefined> {
    return undefined
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

  async listItems(orderId: string): Promise<OrderItemRecord[]> {
    return this.itemsByOrder.get(orderId) ?? []
  }

  async list(): ReturnType<OrderRepositoryInterface['list']> {
    return { items: [], total: 0 }
  }

  async updateStatus(id: string, status: string): Promise<OrderRecord | undefined> {
    const order = this.orders.get(id)
    if (!order) return undefined
    const updated = { ...order, status, updatedAt: new Date() }
    this.orders.set(id, updated)
    return updated
  }

  async cancelAndRestoreStock(id: string): Promise<OrderRecord | undefined> {
    const order = this.orders.get(id)
    if (!order) return undefined

    this.stockRestoredCalls.push(id)
    for (const item of this.itemsByOrder.get(id) ?? []) {
      this.stock.set(item.productId, (this.stock.get(item.productId) ?? 0) + item.quantity)
    }

    const updated = { ...order, status: ORDER_STATUS.CANCELLED, updatedAt: new Date() }
    this.orders.set(id, updated)
    return updated
  }
}

class FakeJobQueue implements JobQueue {
  readonly jobs: { name: string; data: Record<string, unknown> }[] = []

  async add(name: string, data: Record<string, unknown>): Promise<unknown> {
    this.jobs.push({ name, data })
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
    status: ORDER_STATUS.PENDING_CONFIRMATION,
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

describe('UpdateOrderStatusUseCase', () => {
  test('atualiza status normal e enfileira notificação', async () => {
    const stock = new Map<string, number>()
    const orderRepository = new FakeOrderRepository(stock)
    const order = buildOrder()
    orderRepository.orders.set(order.id, order)
    const notificationQueue = new FakeJobQueue()
    const useCase = new UpdateOrderStatusUseCase({ orderRepository, notificationQueue })

    const result = await useCase.execute({ orderId: order.id, status: ORDER_STATUS.CONFIRMED })

    expect(result.order.status).toBe(ORDER_STATUS.CONFIRMED)
    expect(orderRepository.stockRestoredCalls).toHaveLength(0)
    expect(notificationQueue.jobs).toEqual([
      { name: 'order-status-changed', data: { orderId: order.id, status: ORDER_STATUS.CONFIRMED } },
    ])
  })

  test('cancelamento devolve o estoque via cancelAndRestoreStock', async () => {
    const stock = new Map<string, number>([['product-1', 3]])
    const orderRepository = new FakeOrderRepository(stock)
    const order = buildOrder()
    orderRepository.orders.set(order.id, order)
    orderRepository.itemsByOrder.set(order.id, [
      {
        id: 'item-1',
        orderId: order.id,
        productId: 'product-1',
        productName: 'Arroz',
        unitPriceInCents: 2500,
        quantity: 2,
        totalInCents: 5000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    const notificationQueue = new FakeJobQueue()
    const useCase = new UpdateOrderStatusUseCase({ orderRepository, notificationQueue })

    const result = await useCase.execute({ orderId: order.id, status: ORDER_STATUS.CANCELLED })

    expect(result.order.status).toBe(ORDER_STATUS.CANCELLED)
    expect(orderRepository.stockRestoredCalls).toEqual([order.id])
    expect(stock.get('product-1')).toBe(5)
  })

  test('lança OrderNotFoundError quando o pedido não existe', async () => {
    const orderRepository = new FakeOrderRepository(new Map())
    const notificationQueue = new FakeJobQueue()
    const useCase = new UpdateOrderStatusUseCase({ orderRepository, notificationQueue })

    await expect(useCase.execute({ orderId: 'missing', status: ORDER_STATUS.CONFIRMED })).rejects.toBeInstanceOf(
      OrderNotFoundError,
    )
    expect(notificationQueue.jobs).toHaveLength(0)
  })
})
