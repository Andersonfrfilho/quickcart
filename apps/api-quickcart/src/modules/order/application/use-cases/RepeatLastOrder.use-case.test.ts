/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Unit test com fakes em memória — cobre a cópia dos itens do último pedido para um
 * carrinho aberto (novo ou existente) e o skip não-fatal de produtos indisponíveis/removidos.
 */

import { describe, expect, test } from 'bun:test'
import { OrderNoPreviousOrderError } from '@/shared/errors/OrderErrors'
import { CART_STATUS } from '@/modules/cart/shared/Cart.constant'
import type {
  AddCartItemRecordParams,
  CartItemRecord,
  CartRecord,
  CartRepositoryInterface,
  CreateCartRecordParams,
} from '@/modules/cart/domain/CartRepository.interface'
import type {
  CreateProductRecordParams,
  ListProductsRepositoryParams,
  ListProductsRepositoryResult,
  ProductRepositoryInterface,
  ProductSearchResult,
  UpdateProductRecordParams,
} from '@/modules/catalog/domain/ProductRepository.interface'
import type { OrderItemRecord, OrderRecord, OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import type { Product } from '@/infra/database/schema'
import { RepeatLastOrderUseCase } from './RepeatLastOrder.use-case'

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

  async createWithStockDecrement(): ReturnType<OrderRepositoryInterface['createWithStockDecrement']> {
    throw new Error('not implemented')
  }

  async findById(id: string): Promise<OrderRecord | undefined> {
    return this.orders.get(id)
  }

  async findByShortCode(): Promise<OrderRecord | undefined> {
    return undefined
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
    channel: 'whatsapp',
    status: 'completed',
    totalInCents: 5000,
    deliveryType: 'delivery',
    address: null,
    paymentMethod: 'pix',
    receiptPreference: 'whatsapp',
    fiscalDocumentId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function buildOrderItem(overrides: Partial<OrderItemRecord> = {}): OrderItemRecord {
  return {
    id: 'order-item-1',
    orderId: 'order-1',
    productId: 'product-1',
    productName: 'Arroz Branco 5kg',
    unitPriceInCents: 2500,
    quantity: 2,
    totalInCents: 5000,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
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

describe('RepeatLastOrderUseCase', () => {
  test('copia os itens do último pedido para um novo carrinho aberto', async () => {
    const orderRepository = new FakeOrderRepository()
    const order = buildOrder()
    orderRepository.orders.set(order.id, order)
    orderRepository.itemsByOrder.set(order.id, [buildOrderItem()])

    const products = new Map([['product-1', buildProduct()]])
    const productRepository = new FakeProductRepository(products)
    const cartRepository = new FakeCartRepository()
    const useCase = new RepeatLastOrderUseCase({ orderRepository, cartRepository, productRepository })

    const result = await useCase.execute({ customerId: 'customer-1', channel: 'whatsapp' })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.productId).toBe('product-1')
    expect(result.items[0]?.quantity).toBe(2)
    expect(result.items[0]?.matchType).toBe('manual')
    expect(result.skippedItems).toHaveLength(0)
    expect(result.cart.status).toBe(CART_STATUS.OPEN)
  })

  test('reaproveita o carrinho aberto existente em vez de criar outro', async () => {
    const orderRepository = new FakeOrderRepository()
    const order = buildOrder()
    orderRepository.orders.set(order.id, order)
    orderRepository.itemsByOrder.set(order.id, [buildOrderItem()])

    const products = new Map([['product-1', buildProduct()]])
    const productRepository = new FakeProductRepository(products)
    const cartRepository = new FakeCartRepository()
    const existingCart = await cartRepository.create({ id: 'cart-existing', customerId: 'customer-1', channel: 'whatsapp' })
    const useCase = new RepeatLastOrderUseCase({ orderRepository, cartRepository, productRepository })

    const result = await useCase.execute({ customerId: 'customer-1', channel: 'whatsapp' })

    expect(result.cart.id).toBe(existingCart.id)
    expect(cartRepository.carts.size).toBe(1)
  })

  test('não duplica item já existente no carrinho aberto', async () => {
    const orderRepository = new FakeOrderRepository()
    const order = buildOrder()
    orderRepository.orders.set(order.id, order)
    orderRepository.itemsByOrder.set(order.id, [buildOrderItem()])

    const products = new Map([['product-1', buildProduct()]])
    const productRepository = new FakeProductRepository(products)
    const cartRepository = new FakeCartRepository()
    const existingCart = await cartRepository.create({ id: 'cart-existing', customerId: 'customer-1', channel: 'whatsapp' })
    await cartRepository.addItem({ id: 'existing-item', cartId: existingCart.id, productId: 'product-1', quantity: 1, matchType: 'auto' })
    const useCase = new RepeatLastOrderUseCase({ orderRepository, cartRepository, productRepository })

    const result = await useCase.execute({ customerId: 'customer-1', channel: 'whatsapp' })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.id).toBe('existing-item')
  })

  test('pula itens cujo produto não existe mais ou está indisponível', async () => {
    const orderRepository = new FakeOrderRepository()
    const order = buildOrder()
    orderRepository.orders.set(order.id, order)
    orderRepository.itemsByOrder.set(order.id, [
      buildOrderItem({ id: 'item-missing', productId: 'missing-product', productName: 'Produto Removido' }),
      buildOrderItem({ id: 'item-unavailable', productId: 'product-2', productName: 'Leite', quantity: 1 }),
    ])

    const products = new Map([['product-2', buildProduct({ id: 'product-2', name: 'Leite', isAvailable: false })]])
    const productRepository = new FakeProductRepository(products)
    const cartRepository = new FakeCartRepository()
    const useCase = new RepeatLastOrderUseCase({ orderRepository, cartRepository, productRepository })

    const result = await useCase.execute({ customerId: 'customer-1', channel: 'whatsapp' })

    expect(result.items).toHaveLength(0)
    expect(result.skippedItems).toEqual([
      { productId: 'missing-product', productName: 'Produto Removido' },
      { productId: 'product-2', productName: 'Leite' },
    ])
  })

  test('lança OrderNoPreviousOrderError quando não há pedido anterior', async () => {
    const orderRepository = new FakeOrderRepository()
    const productRepository = new FakeProductRepository(new Map())
    const cartRepository = new FakeCartRepository()
    const useCase = new RepeatLastOrderUseCase({ orderRepository, cartRepository, productRepository })

    await expect(useCase.execute({ customerId: 'customer-1', channel: 'whatsapp' })).rejects.toBeInstanceOf(
      OrderNoPreviousOrderError,
    )
  })
})
