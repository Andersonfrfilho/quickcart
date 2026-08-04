/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Unit test com fakes em memória — cobre criação de pedido web, replay de
 * Idempotency-Key (sem duplicar pedido) e estoque insuficiente.
 */

import { describe, expect, test } from 'bun:test'
import { OrderInsufficientStockError } from '@/shared/errors/OrderErrors'
import type { CacheProvider } from '@/shared/providers/CacheProvider.interface'
import type {
  CustomerRepositoryInterface,
  UpdateContactInfoParams,
  UpsertCustomerByPhoneParams,
} from '@/modules/webhook/domain/CustomerRepository.interface'
import type {
  CreateProductRecordParams,
  ListProductsRepositoryParams,
  ListProductsRepositoryResult,
  ProductRepositoryInterface,
  ProductSearchResult,
  UpdateProductRecordParams,
} from '@/modules/catalog/domain/ProductRepository.interface'
import type {
  CreateOrderWithItemsParams,
  CreateOrderWithItemsResult,
  InsufficientStockItem,
  OrderItemRecord,
  OrderRecord,
  OrderRepositoryInterface,
} from '@/modules/order/domain/OrderRepository.interface'
import type { JobQueue } from '@/modules/order/domain/JobQueue.interface'
import type { Customer, Product } from '@/infra/database/schema'
import { CreateWebOrderUseCase } from './CreateWebOrder.use-case'

class FakeCacheProvider implements CacheProvider {
  private readonly store = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  async setIfNotExists(key: string, value: string): Promise<boolean> {
    if (this.store.has(key)) return false
    this.store.set(key, value)
    return true
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key)
  }
}

class FakeCustomerRepository implements CustomerRepositoryInterface {
  readonly upsertCalls: UpsertCustomerByPhoneParams[] = []

  async findById(): Promise<Customer | undefined> {
    return undefined
  }

  async findByPhone(): Promise<Customer | undefined> {
    return undefined
  }

  async upsertByPhone(params: UpsertCustomerByPhoneParams): Promise<Customer> {
    this.upsertCalls.push(params)
    return {
      id: 'customer-1',
      phone: params.phone,
      name: params.name ?? null,
      email: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  async updateContactInfo(params: UpdateContactInfoParams): Promise<Customer> {
    return {
      id: params.customerId,
      phone: '',
      name: null,
      email: params.email ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }
}

class FakeProductRepository implements ProductRepositoryInterface {
  constructor(private readonly products: Map<string, Product>) {}

  async create(_params: CreateProductRecordParams): Promise<Product> {
    throw new Error('not implemented')
  }

  async update(_id: string, _params: UpdateProductRecordParams): Promise<Product> {
    throw new Error('not implemented')
  }

  async findById(id: string): Promise<Product | undefined> {
    return this.products.get(id)
  }

  async findByBarcode(_barcode: string): Promise<Product | undefined> {
    return undefined
  }

  async adjustStock(_id: string, _delta: number): Promise<Product | undefined> {
    return undefined
  }

  async list(_params: ListProductsRepositoryParams): Promise<ListProductsRepositoryResult> {
    return { items: [], total: 0 }
  }

  async searchByTerm(_term: string, _limit: number): Promise<ProductSearchResult[]> {
    return []
  }
}

class FakeOrderRepository implements OrderRepositoryInterface {
  readonly orders = new Map<string, OrderRecord>()
  readonly itemsByOrder = new Map<string, OrderItemRecord[]>()

  constructor(private readonly products: Map<string, Product>) {}

  async createWithStockDecrement(params: CreateOrderWithItemsParams): Promise<CreateOrderWithItemsResult> {
    const insufficientItems: InsufficientStockItem[] = []
    for (const item of params.items) {
      const product = this.products.get(item.productId)
      const available = product?.stockQuantity ?? 0
      if (available < item.quantity) insufficientItems.push({ productId: item.productId, requested: item.quantity, available })
    }
    if (insufficientItems.length > 0) return { ok: false, insufficientItems }

    for (const item of params.items) {
      const product = this.products.get(item.productId)
      if (product) product.stockQuantity -= item.quantity
    }

    const order: OrderRecord = {
      id: params.id,
      shortCode: `QC-${1000 + this.orders.size}`,
      customerId: params.customerId,
      cartId: params.cartId ?? null,
      channel: params.channel,
      status: 'pending_confirmation',
      totalInCents: params.items.reduce((sum, item) => sum + item.totalInCents, 0),
      deliveryType: params.deliveryType,
      address: params.address ?? null,
      legacyAddressText: null,
      paymentMethod: params.paymentMethod,
      receiptPreference: params.receiptPreference,
      fiscalDocumentId: null,
      notes: params.notes ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.orders.set(order.id, order)

    const items: OrderItemRecord[] = params.items.map((item, index) => ({
      id: `${order.id}-item-${index}`,
      orderId: order.id,
      productId: item.productId,
      productName: item.productName,
      unitPriceInCents: item.unitPriceInCents,
      quantity: item.quantity,
      totalInCents: item.totalInCents,
      unavailableAt: null,
      unavailableNotifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
    this.itemsByOrder.set(order.id, items)

    return { ok: true, order, items }
  }

  async findById(id: string): Promise<OrderRecord | undefined> {
    return this.orders.get(id)
  }

  async findByShortCode(shortCode: string): Promise<OrderRecord | undefined> {
    return [...this.orders.values()].find((order) => order.shortCode === shortCode)
  }

  async findLastByCustomer(customerId: string): Promise<OrderRecord | undefined> {
    return [...this.orders.values()]
      .filter((order) => order.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
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
    if (order.status === 'cancelled') return order

    for (const item of this.itemsByOrder.get(id) ?? []) {
      const product = this.products.get(item.productId)
      if (product) product.stockQuantity += item.quantity
    }

    const updated = { ...order, status: 'cancelled', updatedAt: new Date() }
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

function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    categoryId: 'category-1',
    name: 'Arroz Branco 5kg',
    brand: 'Tio João',
    description: null,
    unit: 'un',
    unitSize: null,
    priceInCents: 2500,
    stockQuantity: 10,
    isAvailable: true,
    imageUrl: null,
    aliases: [],
    barcode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function buildDependencies(products: Map<string, Product>) {
  const orderRepository = new FakeOrderRepository(products)
  const productRepository = new FakeProductRepository(products)
  const customerRepository = new FakeCustomerRepository()
  const cacheProvider = new FakeCacheProvider()
  const receiptQueue = new FakeJobQueue()
  const useCase = new CreateWebOrderUseCase({ orderRepository, productRepository, customerRepository, cacheProvider, receiptQueue })

  return { useCase, orderRepository, productRepository, customerRepository, cacheProvider, receiptQueue }
}

describe('CreateWebOrderUseCase', () => {
  test('cria pedido web, faz upsert do customer, decrementa estoque e enfileira recibo', async () => {
    const products = new Map([['product-1', buildProduct()]])
    const { useCase, customerRepository, cacheProvider, receiptQueue } = buildDependencies(products)

    const result = await useCase.execute({
      idempotencyKey: 'idem-1',
      customer: { name: 'Maria', phone: '5511999999999' },
      items: [{ productId: 'product-1', quantity: 2 }],
      deliveryType: 'delivery',
      paymentMethod: 'pix',
      receiptPreference: 'email',
    })

    expect(result.order.totalInCents).toBe(5000)
    expect(customerRepository.upsertCalls).toEqual([{ phone: '5511999999999', name: 'Maria' }])
    expect(products.get('product-1')?.stockQuantity).toBe(8)
    expect(await cacheProvider.get('order:idempotency:idem-1')).toBe(result.order.shortCode)
    expect(receiptQueue.jobs).toEqual([{ name: 'issue-receipt', data: { orderId: result.order.id } }])
  })

  test('replay da mesma Idempotency-Key devolve o pedido já criado sem duplicar', async () => {
    const products = new Map([['product-1', buildProduct()]])
    const { useCase, orderRepository } = buildDependencies(products)

    const params = {
      idempotencyKey: 'idem-repeat',
      customer: { name: 'Maria', phone: '5511999999999' },
      items: [{ productId: 'product-1', quantity: 1 }],
      deliveryType: 'delivery',
      paymentMethod: 'pix',
      receiptPreference: 'email',
    }

    const firstResult = await useCase.execute(params)
    const secondResult = await useCase.execute(params)

    expect(secondResult.order.id).toBe(firstResult.order.id)
    expect(orderRepository.orders.size).toBe(1)
    expect(products.get('product-1')?.stockQuantity).toBe(9)
  })

  test('lança OrderInsufficientStockError quando o estoque é insuficiente', async () => {
    const products = new Map([['product-1', buildProduct({ stockQuantity: 1 })]])
    const { useCase } = buildDependencies(products)

    await expect(
      useCase.execute({
        idempotencyKey: 'idem-2',
        customer: { name: 'Maria', phone: '5511999999999' },
        items: [{ productId: 'product-1', quantity: 5 }],
        deliveryType: 'delivery',
        paymentMethod: 'pix',
        receiptPreference: 'email',
      }),
    ).rejects.toBeInstanceOf(OrderInsufficientStockError)
  })
})
