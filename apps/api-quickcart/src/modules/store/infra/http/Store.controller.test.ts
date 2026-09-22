/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cobre a rota pública `POST /v1/store/checkout-quote` (T2.2, T4.1): preço sempre lido do banco
 * (nunca do corpo), taxa por faixa de distância via `QuoteDeliveryFee`, total = amountDue, produto
 * inexistente recusado, corpo inválido, limite de itens e entrega sem CEP (422).
 */

import { describe, expect, it } from 'bun:test'
import type { ParsedRequest, ResponseHelper } from '@/infra/http/router'
import { CHECKOUT_QUOTE_MAX_ITEMS } from '@/modules/store/shared/Store.constant'
import { DELIVERY_QUOTE_KIND, DELIVERY_UNAVAILABLE_REASON, DELIVERY_LOCATION_SOURCE } from '@/modules/order/shared/DeliveryFeeQuote.constant'
import type { QuoteDeliveryFeeResult } from '@/modules/order/application/types/QuoteDeliveryFee.types'
import { ValidationError } from '@/shared/errors/AppError.error'
import { ProductNotFoundError } from '@/shared/errors/CatalogErrors'
import { StoreController } from './Store.controller'

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111'
const CEP = '01001000'

function buildRequest(body: unknown): ParsedRequest {
  return { method: 'POST', url: '/v1/store/checkout-quote', query: new URLSearchParams(), headers: {}, params: [], body, rawBody: Buffer.from('') }
}

function buildResponseSpy() {
  const calls: { statusCode: number; payload: unknown }[] = []
  const response = {
    json(statusCode: number, payload: unknown) {
      calls.push({ statusCode, payload })
    },
    text() {},
    binary() {},
    error(error: unknown) {
      throw error
    },
  } as unknown as ResponseHelper
  return { response, calls }
}

function buildController(
  overrides: {
    readonly priceInCents?: number
    readonly isAvailable?: boolean
    readonly notFound?: boolean
    readonly quoteResult?: QuoteDeliveryFeeResult
  } = {},
) {
  const quoteResult: QuoteDeliveryFeeResult = overrides.quoteResult ?? { kind: DELIVERY_QUOTE_KIND.PICKUP, feeInCents: 0 }
  return new StoreController({
    registerCustomerUseCase: {} as never,
    listMyOrdersUseCase: {} as never,
    quoteDeliveryFeeUseCase: { async execute() { return quoteResult } },
    productRepository: {
      async findByIds() {
        if (overrides.notFound) return []
        return [{ id: PRODUCT_ID, name: 'Arroz 5kg', priceInCents: overrides.priceInCents ?? 2490, isAvailable: overrides.isAvailable ?? true }]
      },
    } as never,
  })
}

describe('StoreController.handleGetCheckoutQuote', () => {
  it('calcula subtotal e total a partir do preço do banco, ignorando o preço do corpo', async () => {
    const controller = buildController({
      priceInCents: 2490,
      quoteResult: {
        kind: DELIVERY_QUOTE_KIND.QUOTED,
        feeInCents: 800,
        distanceKm: 2.4,
        tier: { maxDistanceKm: 3, feeInCents: 800 },
        source: DELIVERY_LOCATION_SOURCE.CEP,
      },
    })
    const { response, calls } = buildResponseSpy()

    await controller.handleGetCheckoutQuote(
      buildRequest({ items: [{ productId: PRODUCT_ID, quantity: 2, priceInCents: 1 }], deliveryType: 'delivery', cep: CEP }),
      response,
    )

    const payload = calls[0]?.payload as {
      data: {
        subtotalInCents: number
        deliveryFeeInCents: number
        amountDueInCents: number
        isDeliveryAvailable: boolean
        deliveryQuote: { kind: string; distanceKm: number; tier: { maxDistanceKm: number; feeInCents: number } }
      }
    }
    expect(payload.data.subtotalInCents).toBe(4980)
    expect(payload.data.deliveryFeeInCents).toBe(800)
    expect(payload.data.amountDueInCents).toBe(5780)
    expect(payload.data.isDeliveryAvailable).toBe(true)
    expect(payload.data.deliveryQuote).toEqual({ kind: 'quoted', distanceKm: 2.4, tier: { maxDistanceKm: 3, feeInCents: 800 } })
  })

  it('retirada: taxa é zero, sem chamar CEP nenhum', async () => {
    const controller = buildController()
    const { response, calls } = buildResponseSpy()

    await controller.handleGetCheckoutQuote(buildRequest({ items: [{ productId: PRODUCT_ID, quantity: 1 }], deliveryType: 'pickup' }), response)

    const payload = calls[0]?.payload as { data: { deliveryFeeInCents: number; amountDueInCents: number; isDeliveryAvailable: boolean } }
    expect(payload.data.deliveryFeeInCents).toBe(0)
    expect(payload.data.amountDueInCents).toBe(2490)
    expect(payload.data.isDeliveryAvailable).toBe(true)
  })

  it('CEP aproximado (centro da cidade) cobra a maior faixa, sem distância', async () => {
    const controller = buildController({
      quoteResult: {
        kind: DELIVERY_QUOTE_KIND.APPROXIMATE_MAX_TIER,
        feeInCents: 1000,
        tier: { maxDistanceKm: 8, feeInCents: 1000 },
        source: DELIVERY_LOCATION_SOURCE.CEP_APPROXIMATE,
      },
    })
    const { response, calls } = buildResponseSpy()

    await controller.handleGetCheckoutQuote(
      buildRequest({ items: [{ productId: PRODUCT_ID, quantity: 1 }], deliveryType: 'delivery', cep: CEP }),
      response,
    )

    const payload = calls[0]?.payload as { data: { deliveryFeeInCents: number; isDeliveryAvailable: boolean; deliveryQuote: unknown } }
    expect(payload.data.deliveryFeeInCents).toBe(1000)
    expect(payload.data.isDeliveryAvailable).toBe(true)
    expect(payload.data.deliveryQuote).toEqual({ kind: 'approximate_max_tier', tier: { maxDistanceKm: 8, feeInCents: 1000 } })
  })

  it('fora do raio: taxa zero, indisponível, e devolve a distância e o limite', async () => {
    const controller = buildController({
      quoteResult: { kind: DELIVERY_QUOTE_KIND.OUT_OF_RANGE, distanceKm: 12.3, maxDistanceKm: 8 },
    })
    const { response, calls } = buildResponseSpy()

    await controller.handleGetCheckoutQuote(
      buildRequest({ items: [{ productId: PRODUCT_ID, quantity: 1 }], deliveryType: 'delivery', cep: CEP }),
      response,
    )

    const payload = calls[0]?.payload as { data: { deliveryFeeInCents: number; isDeliveryAvailable: boolean; deliveryQuote: unknown } }
    expect(payload.data.deliveryFeeInCents).toBe(0)
    expect(payload.data.isDeliveryAvailable).toBe(false)
    expect(payload.data.deliveryQuote).toEqual({ kind: 'out_of_range', distanceKm: 12.3, maxDistanceKm: 8 })
  })

  it('indisponível (sem coordenada): taxa zero, indisponível', async () => {
    const controller = buildController({
      quoteResult: { kind: DELIVERY_QUOTE_KIND.UNAVAILABLE, reason: DELIVERY_UNAVAILABLE_REASON.GEOCODING_FAILED },
    })
    const { response, calls } = buildResponseSpy()

    await controller.handleGetCheckoutQuote(
      buildRequest({ items: [{ productId: PRODUCT_ID, quantity: 1 }], deliveryType: 'delivery', cep: CEP }),
      response,
    )

    const payload = calls[0]?.payload as { data: { deliveryFeeInCents: number; isDeliveryAvailable: boolean; deliveryQuote: unknown } }
    expect(payload.data.deliveryFeeInCents).toBe(0)
    expect(payload.data.isDeliveryAvailable).toBe(false)
    expect(payload.data.deliveryQuote).toEqual({ kind: 'unavailable' })
  })

  it('resposta nunca traz coordenada nem CEP', async () => {
    const controller = buildController({
      quoteResult: {
        kind: DELIVERY_QUOTE_KIND.QUOTED,
        feeInCents: 800,
        distanceKm: 2.4,
        tier: { maxDistanceKm: 3, feeInCents: 800 },
        source: DELIVERY_LOCATION_SOURCE.CEP,
      },
    })
    const { response, calls } = buildResponseSpy()

    await controller.handleGetCheckoutQuote(
      buildRequest({ items: [{ productId: PRODUCT_ID, quantity: 1 }], deliveryType: 'delivery', cep: CEP }),
      response,
    )

    const payload = JSON.stringify(calls[0]?.payload)
    expect(payload).not.toContain(CEP)
    expect(payload.toLowerCase()).not.toContain('latitude')
    expect(payload.toLowerCase()).not.toContain('longitude')
  })

  it('entrega sem CEP é recusada com ValidationError (422)', async () => {
    const controller = buildController()
    const { response } = buildResponseSpy()

    await expect(
      controller.handleGetCheckoutQuote(buildRequest({ items: [{ productId: PRODUCT_ID, quantity: 1 }], deliveryType: 'delivery' }), response),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('produto inexistente é recusado', async () => {
    const controller = buildController({ notFound: true })
    const { response } = buildResponseSpy()

    await expect(
      controller.handleGetCheckoutQuote(
        buildRequest({ items: [{ productId: PRODUCT_ID, quantity: 1 }], deliveryType: 'delivery', cep: CEP }),
        response,
      ),
    ).rejects.toBeInstanceOf(ProductNotFoundError)
  })

  it('produto inativo responde igual ao inexistente (não confirma produto despublicado)', async () => {
    const controller = buildController({ isAvailable: false })
    const { response } = buildResponseSpy()

    await expect(
      controller.handleGetCheckoutQuote(
        buildRequest({ items: [{ productId: PRODUCT_ID, quantity: 1 }], deliveryType: 'delivery', cep: CEP }),
        response,
      ),
    ).rejects.toBeInstanceOf(ProductNotFoundError)
  })

  it('corpo inválido é recusado com ValidationError', async () => {
    const controller = buildController()
    const { response } = buildResponseSpy()

    await expect(
      controller.handleGetCheckoutQuote(buildRequest({ items: [], deliveryType: 'delivery', cep: CEP }), response),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('limite de itens é recusado', async () => {
    const controller = buildController()
    const { response } = buildResponseSpy()
    const items = Array.from({ length: CHECKOUT_QUOTE_MAX_ITEMS + 1 }, () => ({ productId: PRODUCT_ID, quantity: 1 }))

    await expect(
      controller.handleGetCheckoutQuote(buildRequest({ items, deliveryType: 'delivery', cep: CEP }), response),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})
