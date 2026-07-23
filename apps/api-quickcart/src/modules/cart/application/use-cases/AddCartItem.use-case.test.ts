/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Unit test com fakes em memória (sem Postgres real) — cobre criação de carrinho,
 * soma de quantidade em item já existente e as validações de produto/quantidade.
 */

import { describe, expect, test } from 'bun:test'
import { ProductNotFoundError } from '@/shared/errors/CatalogErrors'
import { CartItemInvalidQuantityError, CartItemNotFoundError, CartProductUnavailableError } from '@/shared/errors/CartErrors'
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
import type { Product } from '@/infra/database/schema'
import { AddCartItemUseCase } from './AddCartItem.use-case'
import { RemoveCartItemUseCase } from './RemoveCartItem.use-case'
import { UpdateCartItemQuantityUseCase } from './UpdateCartItemQuantity.use-case'

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
      (cart) => cart.customerId === customerId && cart.channel === channel && cart.status === 'open',
    )
  }

  async create(params: CreateCartRecordParams): Promise<CartRecord> {
    const cart: CartRecord = {
      id: params.id,
      customerId: params.customerId,
      channel: params.channel,
      status: 'open',
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

describe('AddCartItemUseCase', () => {
  test('cria carrinho novo e adiciona item quando cliente não tem carrinho aberto', async () => {
    const productRepository = new FakeProductRepository(new Map([['product-1', buildProduct()]]))
    const cartRepository = new FakeCartRepository()
    const useCase = new AddCartItemUseCase({ cartRepository, productRepository })

    const result = await useCase.execute({
      customerId: 'customer-1',
      channel: 'whatsapp',
      productId: 'product-1',
      quantity: 2,
      matchType: 'auto',
      originalTerm: 'arroz',
    })

    expect(result.cart.customerId).toBe('customer-1')
    expect(result.cart.status).toBe('open')
    expect(result.item.quantity).toBe(2)
    expect(result.item.productId).toBe('product-1')
  })

  test('soma quantidade quando o produto já está no carrinho aberto', async () => {
    const productRepository = new FakeProductRepository(new Map([['product-1', buildProduct()]]))
    const cartRepository = new FakeCartRepository()
    const useCase = new AddCartItemUseCase({ cartRepository, productRepository })

    await useCase.execute({ customerId: 'customer-1', channel: 'whatsapp', productId: 'product-1', quantity: 2, matchType: 'auto' })
    const result = await useCase.execute({
      customerId: 'customer-1',
      channel: 'whatsapp',
      productId: 'product-1',
      quantity: 3,
      matchType: 'auto',
    })

    expect(result.item.quantity).toBe(5)
    expect(await cartRepository.listItems(result.cart.id)).toHaveLength(1)
  })

  test('lança CartItemInvalidQuantityError para quantidade zero ou negativa', async () => {
    const productRepository = new FakeProductRepository(new Map([['product-1', buildProduct()]]))
    const cartRepository = new FakeCartRepository()
    const useCase = new AddCartItemUseCase({ cartRepository, productRepository })

    await expect(
      useCase.execute({ customerId: 'customer-1', channel: 'whatsapp', productId: 'product-1', quantity: 0, matchType: 'auto' }),
    ).rejects.toBeInstanceOf(CartItemInvalidQuantityError)
  })

  test('lança ProductNotFoundError quando o produto não existe', async () => {
    const productRepository = new FakeProductRepository(new Map())
    const cartRepository = new FakeCartRepository()
    const useCase = new AddCartItemUseCase({ cartRepository, productRepository })

    await expect(
      useCase.execute({ customerId: 'customer-1', channel: 'whatsapp', productId: 'missing', quantity: 1, matchType: 'auto' }),
    ).rejects.toBeInstanceOf(ProductNotFoundError)
  })

  test('lança CartProductUnavailableError quando produto está indisponível ou sem estoque', async () => {
    const productRepository = new FakeProductRepository(
      new Map([['product-1', buildProduct({ isAvailable: false })]]),
    )
    const cartRepository = new FakeCartRepository()
    const useCase = new AddCartItemUseCase({ cartRepository, productRepository })

    await expect(
      useCase.execute({ customerId: 'customer-1', channel: 'whatsapp', productId: 'product-1', quantity: 1, matchType: 'auto' }),
    ).rejects.toBeInstanceOf(CartProductUnavailableError)
  })
})

describe('UpdateCartItemQuantityUseCase', () => {
  test('atualiza a quantidade de um item existente', async () => {
    const cartRepository = new FakeCartRepository()
    await cartRepository.create({ id: 'cart-1', customerId: 'customer-1', channel: 'whatsapp' })
    await cartRepository.addItem({ id: 'item-1', cartId: 'cart-1', productId: 'product-1', quantity: 1, matchType: 'auto' })
    const useCase = new UpdateCartItemQuantityUseCase({ cartRepository })

    const result = await useCase.execute({ cartItemId: 'item-1', quantity: 4 })

    expect(result.quantity).toBe(4)
  })

  test('lança CartItemNotFoundError quando o item não existe', async () => {
    const cartRepository = new FakeCartRepository()
    const useCase = new UpdateCartItemQuantityUseCase({ cartRepository })

    await expect(useCase.execute({ cartItemId: 'missing', quantity: 1 })).rejects.toBeInstanceOf(CartItemNotFoundError)
  })

  test('lança CartItemInvalidQuantityError para quantidade inválida', async () => {
    const cartRepository = new FakeCartRepository()
    await cartRepository.create({ id: 'cart-1', customerId: 'customer-1', channel: 'whatsapp' })
    await cartRepository.addItem({ id: 'item-1', cartId: 'cart-1', productId: 'product-1', quantity: 1, matchType: 'auto' })
    const useCase = new UpdateCartItemQuantityUseCase({ cartRepository })

    await expect(useCase.execute({ cartItemId: 'item-1', quantity: -1 })).rejects.toBeInstanceOf(CartItemInvalidQuantityError)
  })
})

describe('RemoveCartItemUseCase', () => {
  test('remove um item existente', async () => {
    const cartRepository = new FakeCartRepository()
    await cartRepository.create({ id: 'cart-1', customerId: 'customer-1', channel: 'whatsapp' })
    await cartRepository.addItem({ id: 'item-1', cartId: 'cart-1', productId: 'product-1', quantity: 1, matchType: 'auto' })
    const useCase = new RemoveCartItemUseCase({ cartRepository })

    await useCase.execute({ cartItemId: 'item-1' })

    expect(await cartRepository.findItemById('item-1')).toBeUndefined()
  })

  test('lança CartItemNotFoundError quando o item não existe', async () => {
    const cartRepository = new FakeCartRepository()
    const useCase = new RemoveCartItemUseCase({ cartRepository })

    await expect(useCase.execute({ cartItemId: 'missing' })).rejects.toBeInstanceOf(CartItemNotFoundError)
  })
})
