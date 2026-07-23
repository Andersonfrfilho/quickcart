/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Idempotência (spec §6): a `Idempotency-Key` do header vira chave no Redis por 24h
 * guardando o `shortCode` do pedido já criado — uma repetição da mesma chave devolve o
 * pedido existente em vez de criar um novo.
 *
 * A reserva usa `SET ... NX` (via `cacheProvider.setIfNotExists`) para eliminar a corrida
 * clássica de check-then-act: duas requisições concorrentes com a mesma chave leriam ambas
 * um cache-miss e criariam dois pedidos. Quem ganha a reserva cria o pedido; quem perde faz
 * polling até o vencedor substituir o sentinela pelo `shortCode` real, ou expira em conflito.
 */

import { ProductNotFoundError } from '@/shared/errors/CatalogErrors'
import { CartProductUnavailableError } from '@/shared/errors/CartErrors'
import { OrderInsufficientStockError, OrderIdempotencyConflictError } from '@/shared/errors/OrderErrors'
import { generateId } from '@/shared/id'
import { CHANNEL } from '@/modules/shared/shared.constant'
import {
  ORDER_IDEMPOTENCY_CACHE_PREFIX,
  ORDER_IDEMPOTENCY_TTL_SECONDS,
  ORDER_IDEMPOTENCY_PENDING_SENTINEL,
  ORDER_IDEMPOTENCY_POLL_INTERVAL_MS,
  ORDER_IDEMPOTENCY_POLL_TIMEOUT_MS,
} from '@/modules/order/shared/Order.constant'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { CustomerRepositoryInterface } from '@/modules/webhook/domain/CustomerRepository.interface'
import type { CacheProvider } from '@/shared/providers/CacheProvider.interface'
import type { OrderRepositoryInterface, CreateOrderItemInput } from '@/modules/order/domain/OrderRepository.interface'
import type { JobQueue } from '@/modules/order/domain/JobQueue.interface'
import type { CreateWebOrderItemInput, CreateWebOrderParams, CreateWebOrderResult } from '../types/CreateWebOrder.types'

type CreateWebOrderUseCaseDependencies = {
  readonly orderRepository: OrderRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
  readonly customerRepository: CustomerRepositoryInterface
  readonly cacheProvider: CacheProvider
  readonly receiptQueue: JobQueue
}

export class CreateWebOrderUseCase {
  constructor(private readonly dependencies: CreateWebOrderUseCaseDependencies) {}

  async execute(params: CreateWebOrderParams): Promise<CreateWebOrderResult> {
    const cacheKey = `${ORDER_IDEMPOTENCY_CACHE_PREFIX}${params.idempotencyKey}`

    const existingOrder = await this.findExistingOrder(cacheKey)
    if (existingOrder) return existingOrder

    const reserved = await this.dependencies.cacheProvider.setIfNotExists(
      cacheKey,
      ORDER_IDEMPOTENCY_PENDING_SENTINEL,
      ORDER_IDEMPOTENCY_TTL_SECONDS,
    )

    if (!reserved) return this.waitForOrder(cacheKey, params.idempotencyKey)

    return this.createOrder(params, cacheKey)
  }

  private async findExistingOrder(cacheKey: string): Promise<CreateWebOrderResult | undefined> {
    const cachedShortCode = await this.dependencies.cacheProvider.get(cacheKey)
    if (!cachedShortCode || cachedShortCode === ORDER_IDEMPOTENCY_PENDING_SENTINEL) return undefined

    const existingOrder = await this.dependencies.orderRepository.findByShortCode(cachedShortCode)
    if (!existingOrder) return undefined

    const existingItems = await this.dependencies.orderRepository.listItems(existingOrder.id)
    return { order: existingOrder, items: existingItems }
  }

  private async waitForOrder(cacheKey: string, idempotencyKey: string): Promise<CreateWebOrderResult> {
    const deadline = Date.now() + ORDER_IDEMPOTENCY_POLL_TIMEOUT_MS

    while (Date.now() < deadline) {
      const existingOrder = await this.findExistingOrder(cacheKey)
      if (existingOrder) return existingOrder
      await Bun.sleep(ORDER_IDEMPOTENCY_POLL_INTERVAL_MS)
    }

    throw new OrderIdempotencyConflictError(idempotencyKey)
  }

  private async createOrder(params: CreateWebOrderParams, cacheKey: string): Promise<CreateWebOrderResult> {
    try {
      const customer = await this.dependencies.customerRepository.upsertByPhone({
        phone: params.customer.phone,
        name: params.customer.name,
      })

      const items = await this.buildOrderItems(params.items)

      const result = await this.dependencies.orderRepository.createWithStockDecrement({
        id: generateId(),
        customerId: customer.id,
        channel: CHANNEL.WEB,
        deliveryType: params.deliveryType,
        address: params.address,
        paymentMethod: params.paymentMethod,
        receiptPreference: params.receiptPreference,
        notes: params.notes,
        items,
      })

      if (!result.ok) throw new OrderInsufficientStockError(result.insufficientItems)

      await this.dependencies.cacheProvider.set(cacheKey, result.order.shortCode, ORDER_IDEMPOTENCY_TTL_SECONDS)
      await this.dependencies.receiptQueue.add('issue-receipt', { orderId: result.order.id })

      return { order: result.order, items: result.items }
    } catch (error) {
      await this.dependencies.cacheProvider.del(cacheKey)
      throw error
    }
  }

  private async buildOrderItems(requestedItems: ReadonlyArray<CreateWebOrderItemInput>): Promise<CreateOrderItemInput[]> {
    const items: CreateOrderItemInput[] = []

    for (const requestedItem of requestedItems) {
      const product = await this.dependencies.productRepository.findById(requestedItem.productId)
      if (!product) throw new ProductNotFoundError(requestedItem.productId)
      if (!product.isAvailable) throw new CartProductUnavailableError(requestedItem.productId)

      items.push({
        productId: product.id,
        productName: product.name,
        unitPriceInCents: product.priceInCents,
        quantity: requestedItem.quantity,
        totalInCents: Math.round(product.priceInCents * requestedItem.quantity),
      })
    }

    return items
  }
}
