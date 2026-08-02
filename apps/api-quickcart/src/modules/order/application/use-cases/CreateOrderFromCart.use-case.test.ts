/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Unit test com fakes em memória (sem Postgres real) — o FakeOrderRepository simula o
 * decremento atômico de estoque operando diretamente sobre os mesmos objetos `Product`
 * usados pelo FakeProductRepository, para refletir o comportamento transacional real.
 */

import { describe, expect, test } from 'bun:test'
import { ProductNotFoundError } from '@/shared/errors/CatalogErrors'
import { CartProductUnavailableError } from '@/shared/errors/CartErrors'
import { OrderEmptyCartError, OrderInsufficientStockError } from '@/shared/errors/OrderErrors'
import { CART_STATUS } from '@/modules/cart/shared/Cart.constant'
import type {
  CreateProductRecordParams,
  ListProductsRepositoryParams,
  ListProductsRepositoryResult,
  ProductRepositoryInterface,
  ProductSearchResult,
  UpdateProductRecordParams,
} from '@/modules/catalog/domain/ProductRepository.interface'
import type {
  AddCartItemRecordParams,
  CartItemRecord,
  CartRecord,
  CartRepositoryInterface,
  CreateCartRecordParams,
} from '@/modules/cart/domain/CartRepository.interface'
import type {
  CreateOrderWithItemsParams,
  CreateOrderWithItemsResult,
  InsufficientStockItem,
  OrderItemRecord,
  OrderRecord,
  OrderRepositoryInterface,
} from '@/modules/order/domain/OrderRepository.interface'
import type { JobQueue } from '@/modules/order/domain/JobQueue.interface'
import type { Product } from '@/infra/database/schema'
import { CreateOrderFromCartUseCase } from './CreateOrderFromCart.use-case'

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

class FakeCartRepository implements CartRepositoryInterface {
  readonly carts = new Map<string, CartRecord>()
  readonly items = new Map<string, CartItemRecord>()

  async findOpenByCustomer(customerId: string, channel: string): Promise<CartRecord | undefined> {
    return [...this.carts.values()].find(
      (cart) => cart.customerId === customerId && cart.channel === channel && cart.status === CART_STATUS.OPEN,
    )
  }

  async create(params: CreateCartRecordParams): Promise<CartRecord> {
    const cart: CartRecord = {
      id: params.id,
      customerId: params.customerId,
      channel: params.channel,
      status: CART_STATUS.OPEN,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.carts.set(cart.id, cart)
    return cart
  }

  async findById(id: string): Promise<CartRecord | undefined> {
    return this.carts.get(id)
  }

  async updateStatus(id: string, status: string): Promise<CartRecord | undefined> {
    const cart = this.carts.get(id)
    if (!cart) return undefined
    const updated = { ...cart, status, updatedAt: new Date() }
    this.carts.set(id, updated)
    return updated
  }

  async listItems(cartId: string): Promise<CartItemRecord[]> {
    return [...this.items.values()].filter((item) => item.cartId === cartId)
  }

  async findItemByProduct(cartId: string, productId: string): Promise<CartItemRecord | undefined> {
    return [...this.items.values()].find((item) => item.cartId === cartId && item.productId === productId)
  }

  async findItemById(id: string): Promise<CartItemRecord | undefined> {
    return this.items.get(id)
  }

  async addItem(params: AddCartItemRecordParams): Promise<CartItemRecord> {
    const item: CartItemRecord = {
      id: params.id,
      cartId: params.cartId,
      productId: params.productId,
      quantity: params.quantity,
      matchType: params.matchType,
      originalTerm: params.originalTerm ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.items.set(item.id, item)
    return item
  }

  async updateItemQuantity(id: string, quantity: number): Promise<CartItemRecord | undefined> {
    const item = this.items.get(id)
    if (!item) return undefined
    const updated = { ...item, quantity, updatedAt: new Date() }
    this.items.set(id, updated)
    return updated
  }

  async removeItem(id: string): Promise<void> {
    this.items.delete(id)
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

describe('CreateOrderFromCartUseCase', () => {
  test('cria pedido a partir do carrinho, decrementa estoque e enfileira recibo', async () => {
    const products = new Map([['product-1', buildProduct()]])
    const productRepository = new FakeProductRepository(products)
    const cartRepository = new FakeCartRepository()
    const orderRepository = new FakeOrderRepository(products)
    const receiptQueue = new FakeJobQueue()
    const useCase = new CreateOrderFromCartUseCase({ orderRepository, cartRepository, productRepository, receiptQueue })

    const cart = await cartRepository.create({ id: 'cart-1', customerId: 'customer-1', channel: 'whatsapp' })
    await cartRepository.addItem({ id: 'item-1', cartId: cart.id, productId: 'product-1', quantity: 3, matchType: 'auto' })

    const result = await useCase.execute({
      cartId: cart.id,
      customerId: 'customer-1',
      channel: 'whatsapp',
      deliveryType: 'delivery',
      paymentMethod: 'pix',
      receiptPreference: 'whatsapp',
    })

    expect(result.order.totalInCents).toBe(7500)
    expect(result.items).toHaveLength(1)
    expect(products.get('product-1')?.stockQuantity).toBe(7)
    expect((await cartRepository.findById(cart.id))?.status).toBe(CART_STATUS.ORDERED)
    expect(receiptQueue.jobs).toEqual([{ name: 'issue-receipt', data: { orderId: result.order.id } }])
  })

  test('lança OrderEmptyCartError quando o carrinho está vazio', async () => {
    const products = new Map<string, Product>()
    const productRepository = new FakeProductRepository(products)
    const cartRepository = new FakeCartRepository()
    const orderRepository = new FakeOrderRepository(products)
    const receiptQueue = new FakeJobQueue()
    const useCase = new CreateOrderFromCartUseCase({ orderRepository, cartRepository, productRepository, receiptQueue })

    const cart = await cartRepository.create({ id: 'cart-1', customerId: 'customer-1', channel: 'whatsapp' })

    await expect(
      useCase.execute({
        cartId: cart.id,
        customerId: 'customer-1',
        channel: 'whatsapp',
        deliveryType: 'delivery',
        paymentMethod: 'pix',
        receiptPreference: 'whatsapp',
      }),
    ).rejects.toBeInstanceOf(OrderEmptyCartError)
  })

  test('lança ProductNotFoundError quando o produto do item não existe mais', async () => {
    const products = new Map<string, Product>()
    const productRepository = new FakeProductRepository(products)
    const cartRepository = new FakeCartRepository()
    const orderRepository = new FakeOrderRepository(products)
    const receiptQueue = new FakeJobQueue()
    const useCase = new CreateOrderFromCartUseCase({ orderRepository, cartRepository, productRepository, receiptQueue })

    const cart = await cartRepository.create({ id: 'cart-1', customerId: 'customer-1', channel: 'whatsapp' })
    await cartRepository.addItem({ id: 'item-1', cartId: cart.id, productId: 'missing', quantity: 1, matchType: 'auto' })

    await expect(
      useCase.execute({
        cartId: cart.id,
        customerId: 'customer-1',
        channel: 'whatsapp',
        deliveryType: 'delivery',
        paymentMethod: 'pix',
        receiptPreference: 'whatsapp',
      }),
    ).rejects.toBeInstanceOf(ProductNotFoundError)
  })

  test('lança CartProductUnavailableError quando o produto ficou indisponível', async () => {
    const products = new Map([['product-1', buildProduct({ isAvailable: false })]])
    const productRepository = new FakeProductRepository(products)
    const cartRepository = new FakeCartRepository()
    const orderRepository = new FakeOrderRepository(products)
    const receiptQueue = new FakeJobQueue()
    const useCase = new CreateOrderFromCartUseCase({ orderRepository, cartRepository, productRepository, receiptQueue })

    const cart = await cartRepository.create({ id: 'cart-1', customerId: 'customer-1', channel: 'whatsapp' })
    await cartRepository.addItem({ id: 'item-1', cartId: cart.id, productId: 'product-1', quantity: 1, matchType: 'auto' })

    await expect(
      useCase.execute({
        cartId: cart.id,
        customerId: 'customer-1',
        channel: 'whatsapp',
        deliveryType: 'delivery',
        paymentMethod: 'pix',
        receiptPreference: 'whatsapp',
      }),
    ).rejects.toBeInstanceOf(CartProductUnavailableError)
  })

  test('lança OrderInsufficientStockError e não altera carrinho/estoque quando falta produto', async () => {
    const products = new Map([['product-1', buildProduct({ stockQuantity: 1 })]])
    const productRepository = new FakeProductRepository(products)
    const cartRepository = new FakeCartRepository()
    const orderRepository = new FakeOrderRepository(products)
    const receiptQueue = new FakeJobQueue()
    const useCase = new CreateOrderFromCartUseCase({ orderRepository, cartRepository, productRepository, receiptQueue })

    const cart = await cartRepository.create({ id: 'cart-1', customerId: 'customer-1', channel: 'whatsapp' })
    await cartRepository.addItem({ id: 'item-1', cartId: cart.id, productId: 'product-1', quantity: 5, matchType: 'auto' })

    await expect(
      useCase.execute({
        cartId: cart.id,
        customerId: 'customer-1',
        channel: 'whatsapp',
        deliveryType: 'delivery',
        paymentMethod: 'pix',
        receiptPreference: 'whatsapp',
      }),
    ).rejects.toBeInstanceOf(OrderInsufficientStockError)

    expect(products.get('product-1')?.stockQuantity).toBe(1)
    expect((await cartRepository.findById(cart.id))?.status).toBe(CART_STATUS.OPEN)
    expect(receiptQueue.jobs).toHaveLength(0)
  })
})
