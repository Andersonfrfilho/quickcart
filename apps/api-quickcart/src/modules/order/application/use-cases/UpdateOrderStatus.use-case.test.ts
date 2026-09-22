/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Unit test com fakes em memória — cobre a atualização normal de status, o trajeto da entrega, a
 * ocorrência com motivo, o cancelamento (que devolve estoque, exceto no extraviado) e pedido
 * inexistente.
 */

import { describe, expect, spyOn, test } from 'bun:test'
import {
  OrderInvalidStatusTransitionError,
  OrderNotFoundError,
  OrderReceiptEnqueueFailedError,
} from '@/shared/errors/OrderErrors'
import { ORDER_RECEIPT_ENQUEUE_FAILED } from '@/shared/errors/codes'
import { DELIVERY_FAILURE_REASON, ORDER_STATUS } from '@/modules/order/shared/Order.constant'
import type { OrderItemRecord, OrderRecord, OrderRepositoryInterface , SubstituteItemResult } from '@/modules/order/domain/OrderRepository.interface'
import type { JobQueue, JobQueueAddOptions } from '@/modules/order/domain/JobQueue.interface'
import type {
  NotifyStatusChangedParams,
  OrderStatusNotifier,
} from '@/modules/notification/domain/OrderStatusNotifier.interface'
import { UpdateOrderStatusUseCase } from './UpdateOrderStatus.use-case'

class FakeOrderRepository implements OrderRepositoryInterface {
  readonly orders = new Map<string, OrderRecord>()
  readonly itemsByOrder = new Map<string, OrderItemRecord[]>()
  readonly stockRestoredCalls: string[] = []
  readonly cancelCalls: { orderId: string; restoreStock: boolean }[] = []
  readonly statusWrites: { status: string; deliveryFailureReason: string | null | undefined }[] = []

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
    return order ? { order: { ...order, customerName: null, customerPhone: '' }, items: [], deliveryAttempts: [] } : undefined
  }

  async setItemUnavailable(params: { orderId: string; itemId: string; unavailable: boolean }) {
    // O fake não guarda item: os testes deste caso de uso não passam por falta de produto.
    return this.findDetailById(params.orderId)
  }

  async setItemPicked(): Promise<undefined> {
    throw new Error('not implemented')
  }

  async setAllItemsPicked(): Promise<undefined> {
    throw new Error('not implemented')
  }

  async markItemUnavailableNotified(_params: {
    readonly orderId: string
    readonly itemId: string
  }): Promise<OrderItemRecord | undefined> {
    // O fake não guarda item: os testes deste caso de uso não passam por troca de item em falta.
    return undefined
  }

  async substituteItem(): Promise<SubstituteItemResult> {
    return { ok: false, reason: 'not_substitutable' } as const
  }

  async markUnavailableItemsNotified(_orderId: string) {
    // O fake não guarda item: os testes deste caso de uso não passam por aviso de falta.
    return []
  }

  async listItems(orderId: string): Promise<OrderItemRecord[]> {
    return this.itemsByOrder.get(orderId) ?? []
  }

  async list(): ReturnType<OrderRepositoryInterface['list']> {
    return { items: [], total: 0 }
  }

  async updateStatus(params: {
    orderId: string
    status: string
    deliveryFailureReason?: string | null | undefined
  }): Promise<OrderRecord | undefined> {
    const order = this.orders.get(params.orderId)
    if (!order) return undefined

    this.statusWrites.push({ status: params.status, deliveryFailureReason: params.deliveryFailureReason })

    const updated = {
      ...order,
      status: params.status,
      // `undefined` mantém o que já estava — é o repositório real omitindo a coluna do `set`.
      ...(params.deliveryFailureReason === undefined
        ? {}
        : { deliveryFailureReason: params.deliveryFailureReason }),
      updatedAt: new Date(),
    }
    this.orders.set(params.orderId, updated)
    return updated
  }

  async startCustomerDecision(): Promise<undefined> {
    throw new Error('not implemented')
  }

  async markCustomerDecisionReminded(): Promise<undefined> {
    throw new Error('not implemented')
  }

  async cancel(params: { orderId: string; restoreStock: boolean }): Promise<OrderRecord | undefined> {
    const order = this.orders.get(params.orderId)
    if (!order) return undefined

    this.cancelCalls.push({ orderId: params.orderId, restoreStock: params.restoreStock })

    if (params.restoreStock) {
      this.stockRestoredCalls.push(params.orderId)
      for (const item of this.itemsByOrder.get(params.orderId) ?? []) {
        this.stock.set(item.productId, (this.stock.get(item.productId) ?? 0) + item.quantity)
      }
    }

    const updated = { ...order, status: ORDER_STATUS.CANCELLED, updatedAt: new Date() }
    this.orders.set(params.orderId, updated)
    return updated
  }
}

class FakeOrderStatusNotifier implements OrderStatusNotifier {
  readonly notified: NotifyStatusChangedParams[] = []

  async notifyStatusChanged(params: NotifyStatusChangedParams): Promise<void> {
    this.notified.push(params)
  }
}

/** Espelha o BullMQ no que importa aqui: segundo `add` com o mesmo `jobId` não cria outro job. */
class FakeReceiptQueue implements JobQueue {
  readonly addCalls: { name: string; data: Record<string, unknown>; jobId: string | undefined }[] = []
  readonly jobsById = new Map<string, Record<string, unknown>>()
  onAdd: (() => void) | undefined = undefined
  shouldFailNextAdd = false

  async add(name: string, data: Record<string, unknown>, options?: JobQueueAddOptions): Promise<unknown> {
    if (this.shouldFailNextAdd) {
      this.shouldFailNextAdd = false
      throw new Error('redis fora do ar')
    }
    this.onAdd?.()
    this.addCalls.push({ name, data, jobId: options?.jobId })
    const key = options?.jobId ?? `auto-${this.addCalls.length}`
    if (!this.jobsById.has(key)) this.jobsById.set(key, data)
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
    deliveryFeeInCents: 0,
    deliveryType: 'delivery',
    address: null,
    legacyAddressText: null,
    paymentMethod: 'pix',
    receiptPreference: 'email',
    fiscalDocumentId: null,
    notes: null,
    deliveryFailureReason: null,
    customerDecisionAskedAt: null,
    customerDecisionRemindedAt: null,
      cashChangeForInCents: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('UpdateOrderStatusUseCase', () => {
  test('atualiza status normal e avisa o cliente com o que o template precisa', async () => {
    const stock = new Map<string, number>()
    const orderRepository = new FakeOrderRepository(stock)
    const order = buildOrder()
    orderRepository.orders.set(order.id, order)
    const orderStatusNotifier = new FakeOrderStatusNotifier()
    const useCase = new UpdateOrderStatusUseCase({ orderRepository, orderStatusNotifier, receiptQueue: new FakeReceiptQueue() })

    const result = await useCase.execute({ orderId: order.id, status: ORDER_STATUS.CONFIRMED })

    expect(result.order.status).toBe(ORDER_STATUS.CONFIRMED)
    expect(orderRepository.stockRestoredCalls).toHaveLength(0)
    // `shortCode` e `customerId` vão no evento porque o notificador precisa dos dois: um é o
    // destinatário, o outro é o que o template interpola. Antes o worker buscava o pedido de novo
    // no banco só para descobrir isso.
    expect(orderStatusNotifier.notified).toEqual([
      {
        orderId: order.id,
        customerId: order.customerId,
        shortCode: order.shortCode,
        status: ORDER_STATUS.CONFIRMED,
      },
    ])
  })

  test('cancelamento devolve o estoque', async () => {
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
        unavailableAt: null,
        unavailableNotifiedAt: null,
        pickedAt: null,
        substitutesOrderItemId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    const orderStatusNotifier = new FakeOrderStatusNotifier()
    const useCase = new UpdateOrderStatusUseCase({ orderRepository, orderStatusNotifier, receiptQueue: new FakeReceiptQueue() })

    const result = await useCase.execute({ orderId: order.id, status: ORDER_STATUS.CANCELLED })

    expect(result.order.status).toBe(ORDER_STATUS.CANCELLED)
    expect(orderRepository.stockRestoredCalls).toEqual([order.id])
    expect(stock.get('product-1')).toBe(5)
  })

  test('ocorrência grava o motivo junto do status, numa escrita só', async () => {
    const orderRepository = new FakeOrderRepository(new Map())
    const order = buildOrder({ status: ORDER_STATUS.IN_TRANSIT })
    orderRepository.orders.set(order.id, order)
    const orderStatusNotifier = new FakeOrderStatusNotifier()
    const useCase = new UpdateOrderStatusUseCase({ orderRepository, orderStatusNotifier, receiptQueue: new FakeReceiptQueue() })

    const result = await useCase.execute({
      orderId: order.id,
      status: ORDER_STATUS.DELIVERY_FAILED,
      deliveryFailureReason: DELIVERY_FAILURE_REASON.CUSTOMER_ABSENT,
    })

    expect(result.order.status).toBe(ORDER_STATUS.DELIVERY_FAILED)
    expect(result.order.deliveryFailureReason).toBe(DELIVERY_FAILURE_REASON.CUSTOMER_ABSENT)
    expect(orderRepository.statusWrites).toEqual([
      { status: ORDER_STATUS.DELIVERY_FAILED, deliveryFailureReason: DELIVERY_FAILURE_REASON.CUSTOMER_ABSENT },
    ])
  })

  test('nova tentativa apaga o motivo da viagem anterior', async () => {
    const orderRepository = new FakeOrderRepository(new Map())
    const order = buildOrder({
      status: ORDER_STATUS.DELIVERY_FAILED,
      deliveryFailureReason: DELIVERY_FAILURE_REASON.CUSTOMER_ABSENT,
    })
    orderRepository.orders.set(order.id, order)
    const orderStatusNotifier = new FakeOrderStatusNotifier()
    const useCase = new UpdateOrderStatusUseCase({ orderRepository, orderStatusNotifier, receiptQueue: new FakeReceiptQueue() })

    const result = await useCase.execute({ orderId: order.id, status: ORDER_STATUS.OUT_FOR_DELIVERY })

    // Sem isto a tela mostraria "cliente ausente" num pedido que está de novo na rua.
    expect(result.order.deliveryFailureReason).toBeNull()
  })

  test('extraviado cancela sem devolver ao estoque', async () => {
    const stock = new Map<string, number>([['product-1', 3]])
    const orderRepository = new FakeOrderRepository(stock)
    const order = buildOrder({
      status: ORDER_STATUS.DELIVERY_FAILED,
      deliveryFailureReason: DELIVERY_FAILURE_REASON.LOST,
    })
    orderRepository.orders.set(order.id, order)
    const orderStatusNotifier = new FakeOrderStatusNotifier()
    const useCase = new UpdateOrderStatusUseCase({ orderRepository, orderStatusNotifier, receiptQueue: new FakeReceiptQueue() })

    const result = await useCase.execute({ orderId: order.id, status: ORDER_STATUS.CANCELLED })

    expect(result.order.status).toBe(ORDER_STATUS.CANCELLED)
    // A sacola não voltou para a prateleira: repor criaria estoque de um produto que ninguém tem.
    expect(orderRepository.cancelCalls).toEqual([{ orderId: order.id, restoreStock: false }])
    expect(stock.get('product-1')).toBe(3)
  })

  test('devolvido cancela devolvendo ao estoque', async () => {
    const stock = new Map<string, number>([['product-1', 3]])
    const orderRepository = new FakeOrderRepository(stock)
    const order = buildOrder({
      status: ORDER_STATUS.DELIVERY_FAILED,
      deliveryFailureReason: DELIVERY_FAILURE_REASON.RETURNED,
    })
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
        unavailableAt: null,
        unavailableNotifiedAt: null,
        pickedAt: null,
        substitutesOrderItemId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    const orderStatusNotifier = new FakeOrderStatusNotifier()
    const useCase = new UpdateOrderStatusUseCase({ orderRepository, orderStatusNotifier, receiptQueue: new FakeReceiptQueue() })

    await useCase.execute({ orderId: order.id, status: ORDER_STATUS.CANCELLED })

    expect(stock.get('product-1')).toBe(5)
  })

  test('recusa avançar de ocorrência finalizante para nova entrega', async () => {
    const orderRepository = new FakeOrderRepository(new Map())
    const order = buildOrder({
      status: ORDER_STATUS.DELIVERY_FAILED,
      deliveryFailureReason: DELIVERY_FAILURE_REASON.REFUSED,
    })
    orderRepository.orders.set(order.id, order)
    const orderStatusNotifier = new FakeOrderStatusNotifier()
    const useCase = new UpdateOrderStatusUseCase({ orderRepository, orderStatusNotifier, receiptQueue: new FakeReceiptQueue() })

    await expect(
      useCase.execute({ orderId: order.id, status: ORDER_STATUS.OUT_FOR_DELIVERY }),
    ).rejects.toBeInstanceOf(OrderInvalidStatusTransitionError)
    expect(orderStatusNotifier.notified).toHaveLength(0)
  })

  test('lança OrderNotFoundError quando o pedido não existe', async () => {
    const orderRepository = new FakeOrderRepository(new Map())
    const orderStatusNotifier = new FakeOrderStatusNotifier()
    const useCase = new UpdateOrderStatusUseCase({ orderRepository, orderStatusNotifier, receiptQueue: new FakeReceiptQueue() })

    await expect(useCase.execute({ orderId: 'missing', status: ORDER_STATUS.CONFIRMED })).rejects.toBeInstanceOf(
      OrderNotFoundError,
    )
    expect(orderStatusNotifier.notified).toHaveLength(0)
  })
})

describe('UpdateOrderStatusUseCase — recibo só quando o pedido sai da loja', () => {
  function setup(overrides: Partial<OrderRecord> = {}) {
    const orderRepository = new FakeOrderRepository(new Map())
    const order = buildOrder(overrides)
    orderRepository.orders.set(order.id, order)
    const receiptQueue = new FakeReceiptQueue()
    const useCase = new UpdateOrderStatusUseCase({
      orderRepository,
      orderStatusNotifier: new FakeOrderStatusNotifier(),
      receiptQueue,
    })
    return { orderRepository, order, receiptQueue, useCase }
  }

  const EXPECTED_JOB = { name: 'issue-receipt', data: { orderId: 'order-1' }, jobId: 'issue-receipt-order-1' }

  test('separar não enfileira recibo', async () => {
    const { useCase, receiptQueue } = setup({ status: ORDER_STATUS.PREPARING })

    await useCase.execute({ orderId: 'order-1', status: ORDER_STATUS.SEPARATED })

    expect(receiptQueue.addCalls).toHaveLength(0)
  })

  test('saiu para entrega enfileira um job com jobId estável', async () => {
    const { useCase, receiptQueue } = setup({ status: ORDER_STATUS.SEPARATED })

    await useCase.execute({ orderId: 'order-1', status: ORDER_STATUS.OUT_FOR_DELIVERY })

    expect(receiptQueue.addCalls).toEqual([EXPECTED_JOB])
  })

  test('retirada: pronto para retirar enfileira um job com jobId estável', async () => {
    const { useCase, receiptQueue } = setup({ status: ORDER_STATUS.SEPARATED, deliveryType: 'pickup' })

    await useCase.execute({ orderId: 'order-1', status: ORDER_STATUS.READY_FOR_PICKUP })

    expect(receiptQueue.addCalls).toEqual([EXPECTED_JOB])
  })

  test('cancelado antes de sair não enfileira recibo', async () => {
    const { useCase, receiptQueue } = setup({ status: ORDER_STATUS.PREPARING })

    await useCase.execute({ orderId: 'order-1', status: ORDER_STATUS.SEPARATED })
    await useCase.execute({ orderId: 'order-1', status: ORDER_STATUS.CANCELLED })

    expect(receiptQueue.addCalls).toHaveLength(0)
  })

  test('item em falta antes de sair: o job só é enfileirado depois da reprecificação', async () => {
    const { useCase, receiptQueue, orderRepository, order } = setup({ status: ORDER_STATUS.PREPARING, totalInCents: 5000 })
    const totalsSeenAtEnqueue: number[] = []
    receiptQueue.onAdd = () => {
      totalsSeenAtEnqueue.push(orderRepository.orders.get(order.id)?.totalInCents ?? -1)
    }

    await useCase.execute({ orderId: order.id, status: ORDER_STATUS.SEPARATED })
    // A falta reprecifica o pedido (o repositório real faz isso ao marcar o item); o desvio volta para separado.
    const separated = orderRepository.orders.get(order.id)
    if (!separated) throw new Error('pedido sumiu do fake')
    orderRepository.orders.set(order.id, {
      ...separated,
      status: ORDER_STATUS.AWAITING_CUSTOMER_DECISION,
      totalInCents: 3200,
    })
    await useCase.execute({ orderId: order.id, status: ORDER_STATUS.SEPARATED })
    expect(receiptQueue.addCalls).toHaveLength(0)

    await useCase.execute({ orderId: order.id, status: ORDER_STATUS.OUT_FOR_DELIVERY })

    expect(totalsSeenAtEnqueue).toEqual([3200])
  })

  test('sair de novo depois de ocorrência não cria segundo job', async () => {
    const { useCase, receiptQueue } = setup({ status: ORDER_STATUS.SEPARATED })

    await useCase.execute({ orderId: 'order-1', status: ORDER_STATUS.OUT_FOR_DELIVERY })
    await useCase.execute({
      orderId: 'order-1',
      status: ORDER_STATUS.DELIVERY_FAILED,
      deliveryFailureReason: DELIVERY_FAILURE_REASON.CUSTOMER_ABSENT,
    })
    await useCase.execute({ orderId: 'order-1', status: ORDER_STATUS.OUT_FOR_DELIVERY })

    expect(receiptQueue.jobsById.size).toBe(1)
    expect(receiptQueue.addCalls.map((call) => call.jobId)).toEqual([EXPECTED_JOB.jobId, EXPECTED_JOB.jobId])
  })
})

describe('UpdateOrderStatusUseCase — recuperação quando a fila do recibo cai', () => {
  function setup(overrides: Partial<OrderRecord> = {}) {
    const orderRepository = new FakeOrderRepository(new Map())
    const order = buildOrder({ status: ORDER_STATUS.SEPARATED, ...overrides })
    orderRepository.orders.set(order.id, order)
    const receiptQueue = new FakeReceiptQueue()
    const orderStatusNotifier = new FakeOrderStatusNotifier()
    const useCase = new UpdateOrderStatusUseCase({ orderRepository, orderStatusNotifier, receiptQueue })
    return { orderRepository, order, receiptQueue, orderStatusNotifier, useCase }
  }

  test('fila falha: status fica salvo, erro com código próprio e log sem PII', async () => {
    const { useCase, receiptQueue, orderRepository, orderStatusNotifier, order } = setup()
    receiptQueue.shouldFailNextAdd = true
    const consoleError = spyOn(console, 'error').mockImplementation(() => undefined)

    const failure = await useCase
      .execute({ orderId: order.id, status: ORDER_STATUS.OUT_FOR_DELIVERY })
      .then(() => undefined, (error: unknown) => error)

    const logged = consoleError.mock.calls.map((call) => String(call[0]))
    consoleError.mockRestore()
    expect(failure).toBeInstanceOf(OrderReceiptEnqueueFailedError)
    expect(failure instanceof OrderReceiptEnqueueFailedError ? failure.code : undefined).toBe(ORDER_RECEIPT_ENQUEUE_FAILED)
    expect(orderRepository.orders.get(order.id)?.status).toBe(ORDER_STATUS.OUT_FOR_DELIVERY)
    expect(orderStatusNotifier.notified).toHaveLength(1)
    const receiptLog = logged.find((line) => line.includes('receipt_enqueue_failed'))
    expect(receiptLog).toContain(order.id)
    expect(receiptLog).not.toContain(order.customerId)
  })

  test('repetir o mesmo status depois da falha só enfileira o recibo', async () => {
    const { useCase, receiptQueue, orderRepository, orderStatusNotifier, order } = setup()
    receiptQueue.shouldFailNextAdd = true
    const consoleError = spyOn(console, 'error').mockImplementation(() => undefined)
    await useCase.execute({ orderId: order.id, status: ORDER_STATUS.OUT_FOR_DELIVERY }).catch(() => undefined)
    consoleError.mockRestore()
    const writesBefore = orderRepository.statusWrites.length

    const result = await useCase.execute({ orderId: order.id, status: ORDER_STATUS.OUT_FOR_DELIVERY })

    expect(result.order.status).toBe(ORDER_STATUS.OUT_FOR_DELIVERY)
    expect(receiptQueue.addCalls.map((call) => call.jobId)).toEqual(['issue-receipt-order-1'])
    expect(orderRepository.statusWrites).toHaveLength(writesBefore)
    expect(orderStatusNotifier.notified).toHaveLength(1)
  })

  test('repetir com o recibo já na fila não cria segundo job (o worker ainda pula nota emitida)', async () => {
    const { useCase, receiptQueue, order } = setup({ status: ORDER_STATUS.READY_FOR_PICKUP, deliveryType: 'pickup', fiscalDocumentId: 'chave-1' })
    await useCase.execute({ orderId: order.id, status: ORDER_STATUS.READY_FOR_PICKUP })
    await useCase.execute({ orderId: order.id, status: ORDER_STATUS.READY_FOR_PICKUP })

    expect(receiptQueue.jobsById.size).toBe(1)
  })

  test('repetir um status que não emite recibo continua recusado', async () => {
    const { useCase, receiptQueue, order } = setup()

    await expect(useCase.execute({ orderId: order.id, status: ORDER_STATUS.SEPARATED })).rejects.toBeInstanceOf(
      OrderInvalidStatusTransitionError,
    )
    expect(receiptQueue.addCalls).toHaveLength(0)
  })
})
