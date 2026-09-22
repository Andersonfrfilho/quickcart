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

import {
  OrderInsufficientStockError,
  OrderIdempotencyConflictError,
  DeliveryOutOfRangeError,
  DeliveryFeeChangedError,
  DeliveryUnavailableError,
} from '@/shared/errors/OrderErrors'
import { generateId } from '@/shared/id'
import { buildPricedOrderItems } from '@/modules/order/shared/buildPricedOrderItems'
import { CHANNEL } from '@/modules/shared/shared.constant'
import {
  ORDER_IDEMPOTENCY_CACHE_PREFIX,
  ORDER_IDEMPOTENCY_TTL_SECONDS,
  ORDER_IDEMPOTENCY_PENDING_SENTINEL,
  ORDER_IDEMPOTENCY_POLL_INTERVAL_MS,
  ORDER_IDEMPOTENCY_POLL_TIMEOUT_MS,
  DELIVERY_TYPE,
} from '@/modules/order/shared/Order.constant'
import { DELIVERY_QUOTE_KIND, CUSTOMER_LOCATION_KIND } from '@/modules/order/shared/DeliveryFeeQuote.constant'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { CustomerRepositoryInterface } from '@/modules/webhook/domain/CustomerRepository.interface'
import type { CacheProvider } from '@/shared/providers/CacheProvider.interface'
import type { OrderRepositoryInterface, CreateOrderItemInput } from '@/modules/order/domain/OrderRepository.interface'
import type { QuoteDeliveryFeeUseCase } from '@/modules/order/application/use-cases/QuoteDeliveryFee.use-case'
import type { CreateWebOrderItemInput, CreateWebOrderParams, CreateWebOrderResult } from '../types/CreateWebOrder.types'

type DeliveryQuoteSnapshot = {
  readonly feeInCents: number
  readonly distanceKm: number | null
  readonly tierMaxKm: number | null
  readonly tierFeeInCents: number | null
  readonly locationSource: string | null
}

type CreateWebOrderUseCaseDependencies = {
  readonly orderRepository: OrderRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
  readonly customerRepository: CustomerRepositoryInterface
  readonly cacheProvider: CacheProvider
  /**
   * A web não confia no navegador (spec §3.5): recota pelo CEP do endereço a cada criação, e não lê
   * uma taxa fixa da env. Se a taxa mudou desde a cotação que o cliente viu, `DeliveryFeeChangedError`
   * (409); fora do raio, `DeliveryOutOfRangeError` (422); sem como calcular, `DeliveryUnavailableError`.
   */
  readonly quoteDeliveryFeeUseCase: Pick<QuoteDeliveryFeeUseCase, 'execute'>
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
      const quote = await this.quoteDelivery(params)

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
        deliveryFeeInCents: quote.feeInCents,
        deliveryDistanceKm: quote.distanceKm,
        deliveryTierMaxKm: quote.tierMaxKm,
        deliveryTierFeeInCents: quote.tierFeeInCents,
        deliveryLocationSource: quote.locationSource,
        items,
      })

      if (!result.ok) throw new OrderInsufficientStockError(result.insufficientItems)

      await this.dependencies.cacheProvider.set(cacheKey, result.order.shortCode, ORDER_IDEMPOTENCY_TTL_SECONDS)

      return { order: result.order, items: result.items }
    } catch (error) {
      await this.dependencies.cacheProvider.del(cacheKey)
      throw error
    }
  }

  /**
   * Recota pelo CEP do endereço de entrega (spec §3.5) — nunca confia na taxa que o navegador mandou.
   *
   * A validação do schema já garante endereço presente na entrega e ausente na retirada
   * (`CreateWebOrder.schema.ts`), então `params.address!.cep` é seguro aqui.
   */
  private async quoteDelivery(params: CreateWebOrderParams): Promise<DeliveryQuoteSnapshot> {
    if (params.deliveryType !== DELIVERY_TYPE.DELIVERY) {
      this.assertFeeMatchesExpectation(params, 0)
      return { feeInCents: 0, distanceKm: null, tierMaxKm: null, tierFeeInCents: null, locationSource: null }
    }

    const cep = params.address!.cep
    const quote = await this.dependencies.quoteDeliveryFeeUseCase.execute({
      deliveryType: params.deliveryType,
      location: { kind: CUSTOMER_LOCATION_KIND.CEP, cep },
    })

    if (quote.kind === DELIVERY_QUOTE_KIND.OUT_OF_RANGE) {
      throw new DeliveryOutOfRangeError({ distanceKm: quote.distanceKm, maxDistanceKm: quote.maxDistanceKm })
    }
    if (quote.kind === DELIVERY_QUOTE_KIND.UNAVAILABLE) {
      throw new DeliveryUnavailableError(quote.reason)
    }

    if (quote.kind === DELIVERY_QUOTE_KIND.APPROXIMATE_MAX_TIER) {
      this.assertFeeMatchesExpectation(params, quote.feeInCents)
      return {
        feeInCents: quote.feeInCents,
        distanceKm: null,
        tierMaxKm: quote.tier.maxDistanceKm,
        tierFeeInCents: quote.tier.feeInCents,
        locationSource: quote.source,
      }
    }

    if (quote.kind !== DELIVERY_QUOTE_KIND.QUOTED) {
      // `pickup` nunca chega aqui (retorno antecipado no início do método) — sobra só `quoted`.
      throw new DeliveryUnavailableError('unexpected_quote_kind')
    }

    this.assertFeeMatchesExpectation(params, quote.feeInCents)
    return {
      feeInCents: quote.feeInCents,
      distanceKm: quote.distanceKm,
      tierMaxKm: quote.tier.maxDistanceKm,
      tierFeeInCents: quote.tier.feeInCents,
      locationSource: quote.source,
    }
  }

  private assertFeeMatchesExpectation(params: CreateWebOrderParams, currentFeeInCents: number): void {
    const expected = params.expectedDeliveryFeeInCents
    if (expected === undefined || expected === currentFeeInCents) return
    throw new DeliveryFeeChangedError({ previousFeeInCents: expected, currentFeeInCents })
  }

  private async buildOrderItems(requestedItems: ReadonlyArray<CreateWebOrderItemInput>): Promise<CreateOrderItemInput[]> {
    return buildPricedOrderItems(this.dependencies.productRepository, requestedItems)
  }
}
