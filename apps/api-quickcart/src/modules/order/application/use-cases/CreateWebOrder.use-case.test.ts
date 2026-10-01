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
import {
  OrderInsufficientStockError,
  DeliveryOutOfRangeError,
  DeliveryFeeChangedError,
  DeliveryUnavailableError,
} from '@/shared/errors/OrderErrors'
import {
  DELIVERY_QUOTE_KIND,
  DELIVERY_LOCATION_SOURCE,
  DELIVERY_UNAVAILABLE_REASON,
} from '@/modules/order/shared/DeliveryFeeQuote.constant'
import type {
  AddressLookupProviderInterface,
  AddressLookupResult,
} from '@/modules/shared/address/AddressLookupProvider.interface'
import type { QuoteDeliveryFeeUseCase } from './QuoteDeliveryFee.use-case'
import type { QuoteDeliveryFeeResult } from '@/modules/order/application/types/QuoteDeliveryFee.types'
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
  SubstituteItemResult,
} from '@/modules/order/domain/OrderRepository.interface'
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
  async findByUserId(): Promise<Customer | undefined> {
    return undefined
  }

  async linkToUser(): Promise<Customer> {
    throw new Error('not used in this test')
  }

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
      userId: null,
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
      userId: null,
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

  async findByIds(ids: readonly string[]): Promise<Product[]> {

    const found = await Promise.all(ids.map((id) => this.findById(id)))

    return found.filter((product): product is Product => product !== undefined)

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

  async findSubstituteCandidates(): Promise<ProductSearchResult[]> {
    return []
  }

  async searchByTerm(_term: string, _limit: number): Promise<ProductSearchResult[]> {
    return []
  }

  async listDistinctBrands(): Promise<string[]> {
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
      deliveryFeeInCents: params.deliveryFeeInCents,
      deliveryType: params.deliveryType,
      address: params.address ?? null,
      legacyAddressText: null,
      deliveryDistanceKm: params.deliveryDistanceKm ?? null,
      deliveryTierMaxKm: params.deliveryTierMaxKm ?? null,
      deliveryTierFeeInCents: params.deliveryTierFeeInCents ?? null,
      deliveryLocationSource: params.deliveryLocationSource ?? null,
      paymentMethod: params.paymentMethod,
      receiptPreference: params.receiptPreference,
      fiscalDocumentId: null,
      notes: params.notes ?? null,
      deliveryFailureReason: null,
      customerDecisionAskedAt: null,
      customerDecisionRemindedAt: null,
      cashChangeForInCents: null,
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
        pickedAt: null,
        substitutesOrderItemId: null,
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

  async updateStatus(params: { orderId: string; status: string }): Promise<OrderRecord | undefined> {
    const order = this.orders.get(params.orderId)
    if (!order) return undefined
    const updated = { ...order, status: params.status, updatedAt: new Date() }
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
    if (order.status === 'cancelled') return order

    if (params.restoreStock) {
      for (const item of this.itemsByOrder.get(params.orderId) ?? []) {
        const product = this.products.get(item.productId)
        if (product) product.stockQuantity += item.quantity
      }
    }

    const updated = { ...order, status: 'cancelled', updatedAt: new Date() }
    this.orders.set(params.orderId, updated)
    return updated
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
    aisle: null,
    aliases: [],
    barcode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

class FakeQuoteDeliveryFeeUseCase implements Pick<QuoteDeliveryFeeUseCase, 'execute'> {
  constructor(private readonly result: QuoteDeliveryFeeResult) {}

  readonly calls: unknown[] = []

  async execute(params: unknown): Promise<QuoteDeliveryFeeResult> {
    this.calls.push(params)
    return this.result
  }
}

const DEFAULT_QUOTE_RESULT: QuoteDeliveryFeeResult = {
  kind: DELIVERY_QUOTE_KIND.QUOTED,
  feeInCents: 800,
  distanceKm: 2,
  tier: { maxDistanceKm: 3, feeInCents: 800 },
  source: DELIVERY_LOCATION_SOURCE.CEP,
}

function buildAddress(overrides: Record<string, unknown> = {}) {
  return {
    cep: '01310-100',
    street: 'Av. Paulista',
    number: '1000',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    ...overrides,
  }
}

const VIACEP_LOOKUP: AddressLookupResult = {
  street: 'Avenida Paulista',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
}

class FakeAddressLookupProvider implements AddressLookupProviderInterface {
  constructor(private readonly isKnownCep: boolean = true) {}

  async lookupByCep(): Promise<AddressLookupResult | undefined> {
    return this.isKnownCep ? VIACEP_LOOKUP : undefined
  }
}

function buildDependencies(
  products: Map<string, Product>,
  quoteResult: QuoteDeliveryFeeResult = DEFAULT_QUOTE_RESULT,
  addressLookupProvider: AddressLookupProviderInterface = new FakeAddressLookupProvider(),
) {
  const orderRepository = new FakeOrderRepository(products)
  const productRepository = new FakeProductRepository(products)
  const customerRepository = new FakeCustomerRepository()
  const cacheProvider = new FakeCacheProvider()
  const quoteDeliveryFeeUseCase = new FakeQuoteDeliveryFeeUseCase(quoteResult)
  const useCase = new CreateWebOrderUseCase({
    orderRepository,
    productRepository,
    customerRepository,
    cacheProvider,
    quoteDeliveryFeeUseCase,
    addressLookupProvider,
  })

  return { useCase, orderRepository, productRepository, customerRepository, cacheProvider, quoteDeliveryFeeUseCase }
}

describe('CreateWebOrderUseCase', () => {
  test('cria pedido web, faz upsert do customer, decrementa estoque e NÃO enfileira recibo (o total ainda pode mudar)', async () => {
    const products = new Map([['product-1', buildProduct()]])
    const { useCase, customerRepository, cacheProvider } = buildDependencies(products)

    const result = await useCase.execute({
      idempotencyKey: 'idem-1',
      customer: { name: 'Maria', phone: '5511999999999' },
      items: [{ productId: 'product-1', quantity: 2 }],
      deliveryType: 'delivery',
      address: buildAddress(),
      paymentMethod: 'pix',
      receiptPreference: 'email',
    })

    expect(result.order.totalInCents).toBe(5000)
    expect(customerRepository.upsertCalls).toEqual([{ phone: '5511999999999', name: 'Maria' }])
    expect(products.get('product-1')?.stockQuantity).toBe(8)
    expect(await cacheProvider.get('order:idempotency:idem-1')).toBe(result.order.shortCode)
  })

  test('replay da mesma Idempotency-Key devolve o pedido já criado sem duplicar', async () => {
    const products = new Map([['product-1', buildProduct()]])
    const { useCase, orderRepository } = buildDependencies(products)

    const params = {
      idempotencyKey: 'idem-repeat',
      customer: { name: 'Maria', phone: '5511999999999' },
      items: [{ productId: 'product-1', quantity: 1 }],
      deliveryType: 'delivery',
      address: buildAddress(),
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
        address: buildAddress(),
        paymentMethod: 'pix',
        receiptPreference: 'email',
      }),
    ).rejects.toBeInstanceOf(OrderInsufficientStockError)
  })
})

describe('CreateWebOrderUseCase — recotação com QuoteDeliveryFee (T2.1)', () => {
  function buildParams(deliveryType: string, overrides: Record<string, unknown> = {}) {
    return {
      idempotencyKey: `idem-${deliveryType}-${Math.random()}`,
      customer: { name: 'Maria', phone: '5511999999999' },
      items: [{ productId: 'product-1', quantity: 2 }],
      deliveryType,
      ...(deliveryType === 'delivery' ? { address: buildAddress() } : {}),
      paymentMethod: 'pix',
      receiptPreference: 'email',
      ...overrides,
    }
  }

  test('entrega "quoted" grava taxa, distância, faixa e fonte — fora do total dos itens', async () => {
    const { useCase } = buildDependencies(new Map([['product-1', buildProduct()]]), DEFAULT_QUOTE_RESULT)

    const result = await useCase.execute(buildParams('delivery'))

    expect(result.order.deliveryFeeInCents).toBe(800)
    expect(result.order.totalInCents).toBe(5000)
    expect(result.order.deliveryDistanceKm).toBe(2)
    expect(result.order.deliveryTierMaxKm).toBe(3)
    expect(result.order.deliveryTierFeeInCents).toBe(800)
    expect(result.order.deliveryLocationSource).toBe(DELIVERY_LOCATION_SOURCE.CEP)
  })

  test('entrega "approximate_max_tier" grava a maior faixa sem distância', async () => {
    const { useCase } = buildDependencies(new Map([['product-1', buildProduct()]]), {
      kind: DELIVERY_QUOTE_KIND.APPROXIMATE_MAX_TIER,
      feeInCents: 1000,
      tier: { maxDistanceKm: 8, feeInCents: 1000 },
      source: DELIVERY_LOCATION_SOURCE.CEP_APPROXIMATE,
    })

    const result = await useCase.execute(buildParams('delivery'))

    expect(result.order.deliveryFeeInCents).toBe(1000)
    expect(result.order.deliveryDistanceKm).toBeNull()
    expect(result.order.deliveryTierMaxKm).toBe(8)
    expect(result.order.deliveryLocationSource).toBe(DELIVERY_LOCATION_SOURCE.CEP_APPROXIMATE)
  })

  test('retirada grava taxa 0 e as quatro colunas de cotação nulas — não chama QuoteDeliveryFee', async () => {
    const { useCase, quoteDeliveryFeeUseCase } = buildDependencies(new Map([['product-1', buildProduct()]]))

    const result = await useCase.execute(buildParams('pickup'))

    expect(result.order.deliveryFeeInCents).toBe(0)
    expect(result.order.deliveryDistanceKm).toBeNull()
    expect(result.order.deliveryTierMaxKm).toBeNull()
    expect(result.order.deliveryTierFeeInCents).toBeNull()
    expect(result.order.deliveryLocationSource).toBeNull()
    expect(quoteDeliveryFeeUseCase.calls).toHaveLength(0)
  })

  test('fora do raio lança DeliveryOutOfRangeError (422)', async () => {
    const { useCase } = buildDependencies(new Map([['product-1', buildProduct()]]), {
      kind: DELIVERY_QUOTE_KIND.OUT_OF_RANGE,
      distanceKm: 12,
      maxDistanceKm: 8,
    })

    await expect(useCase.execute(buildParams('delivery'))).rejects.toBeInstanceOf(DeliveryOutOfRangeError)
  })

  test('sem como cotar lança DeliveryUnavailableError', async () => {
    const { useCase } = buildDependencies(new Map([['product-1', buildProduct()]]), {
      kind: DELIVERY_QUOTE_KIND.UNAVAILABLE,
      reason: 'no_store_cep',
    })

    await expect(useCase.execute(buildParams('delivery'))).rejects.toBeInstanceOf(DeliveryUnavailableError)
  })

  test('taxa mudou desde a cotação que o cliente viu → DeliveryFeeChangedError (409)', async () => {
    const { useCase } = buildDependencies(new Map([['product-1', buildProduct()]]), DEFAULT_QUOTE_RESULT)

    await expect(
      useCase.execute(buildParams('delivery', { expectedDeliveryFeeInCents: 500 })),
    ).rejects.toBeInstanceOf(DeliveryFeeChangedError)
  })

  test('taxa igual à esperada cria o pedido normalmente', async () => {
    const { useCase } = buildDependencies(new Map([['product-1', buildProduct()]]), DEFAULT_QUOTE_RESULT)

    const result = await useCase.execute(buildParams('delivery', { expectedDeliveryFeeInCents: 800 }))

    expect(result.order.deliveryFeeInCents).toBe(800)
  })

  test('rua/bairro/cidade/UF do pedido web saem do ViaCEP, não do navegador; número e complemento ficam', async () => {
    const { useCase } = buildDependencies(new Map([['product-1', buildProduct()]]))

    const result = await useCase.execute(
      buildParams('delivery', {
        address: buildAddress({ street: 'Rua Falsa', neighborhood: 'Outro', city: 'Outra', state: 'RJ', complement: 'ap 2' }),
      }),
    )

    expect(result.order.address).toEqual({
      cep: '01310-100',
      number: '1000',
      complement: 'ap 2',
      ...VIACEP_LOOKUP,
    })
  })

  test('CEP que o ViaCEP não conhece → DeliveryUnavailableError com razão cep_not_found', async () => {
    const { useCase, quoteDeliveryFeeUseCase } = buildDependencies(
      new Map([['product-1', buildProduct()]]),
      DEFAULT_QUOTE_RESULT,
      new FakeAddressLookupProvider(false),
    )

    const error = await useCase.execute(buildParams('delivery')).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(DeliveryUnavailableError)
    expect((error as DeliveryUnavailableError).details).toEqual({ reason: DELIVERY_UNAVAILABLE_REASON.CEP_NOT_FOUND })
    expect(quoteDeliveryFeeUseCase.calls).toEqual([])
  })

  test('entrega sem endereço → DeliveryUnavailableError, sem asserção não nula', async () => {
    const { useCase } = buildDependencies(new Map([['product-1', buildProduct()]]))

    await expect(useCase.execute(buildParams('delivery', { address: undefined }))).rejects.toBeInstanceOf(
      DeliveryUnavailableError,
    )
  })
})
