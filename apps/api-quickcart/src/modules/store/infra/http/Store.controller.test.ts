/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cobre a rota pública `POST /v1/store/checkout-quote` (T2.2): preço sempre lido do banco (nunca
 * do corpo), taxa por tipo de entrega, total = amountDue, produto inexistente recusado, corpo
 * inválido e limite de itens.
 */

import { describe, expect, it } from 'bun:test'
import type { ParsedRequest, ResponseHelper } from '@/infra/http/router'
import { CHECKOUT_QUOTE_MAX_ITEMS } from '@/modules/store/shared/Store.constant'
import { ValidationError } from '@/shared/errors/AppError.error'
import { ProductNotFoundError } from '@/shared/errors/CatalogErrors'
import { StoreController } from './Store.controller'

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111'

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

function buildController(overrides: { readonly priceInCents?: number; readonly isAvailable?: boolean; readonly notFound?: boolean } = {}) {
  return new StoreController({
    registerCustomerUseCase: {} as never,
    listMyOrdersUseCase: {} as never,
    deliveryFeeInCents: 800,
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
    const controller = buildController({ priceInCents: 2490 })
    const { response, calls } = buildResponseSpy()

    await controller.handleGetCheckoutQuote(
      buildRequest({ items: [{ productId: PRODUCT_ID, quantity: 2, priceInCents: 1 }], deliveryType: 'delivery' }),
      response,
    )

    const payload = calls[0]?.payload as { data: { subtotalInCents: number; deliveryFeeInCents: number; amountDueInCents: number } }
    expect(payload.data.subtotalInCents).toBe(4980)
    expect(payload.data.deliveryFeeInCents).toBe(800)
    expect(payload.data.amountDueInCents).toBe(5780)
  })

  it('retirada: taxa é zero', async () => {
    const controller = buildController()
    const { response, calls } = buildResponseSpy()

    await controller.handleGetCheckoutQuote(buildRequest({ items: [{ productId: PRODUCT_ID, quantity: 1 }], deliveryType: 'pickup' }), response)

    const payload = calls[0]?.payload as { data: { deliveryFeeInCents: number; amountDueInCents: number } }
    expect(payload.data.deliveryFeeInCents).toBe(0)
    expect(payload.data.amountDueInCents).toBe(2490)
  })

  it('produto inexistente é recusado', async () => {
    const controller = buildController({ notFound: true })
    const { response } = buildResponseSpy()

    await expect(
      controller.handleGetCheckoutQuote(buildRequest({ items: [{ productId: PRODUCT_ID, quantity: 1 }], deliveryType: 'delivery' }), response),
    ).rejects.toBeInstanceOf(ProductNotFoundError)
  })

  it('produto inativo responde igual ao inexistente (não confirma produto despublicado)', async () => {
    const controller = buildController({ isAvailable: false })
    const { response } = buildResponseSpy()

    await expect(
      controller.handleGetCheckoutQuote(buildRequest({ items: [{ productId: PRODUCT_ID, quantity: 1 }], deliveryType: 'delivery' }), response),
    ).rejects.toBeInstanceOf(ProductNotFoundError)
  })

  it('corpo inválido é recusado com ValidationError', async () => {
    const controller = buildController()
    const { response } = buildResponseSpy()

    await expect(controller.handleGetCheckoutQuote(buildRequest({ items: [], deliveryType: 'delivery' }), response)).rejects.toBeInstanceOf(
      ValidationError,
    )
  })

  it('limite de itens é recusado', async () => {
    const controller = buildController()
    const { response } = buildResponseSpy()
    const items = Array.from({ length: CHECKOUT_QUOTE_MAX_ITEMS + 1 }, () => ({ productId: PRODUCT_ID, quantity: 1 }))

    await expect(controller.handleGetCheckoutQuote(buildRequest({ items, deliveryType: 'delivery' }), response)).rejects.toBeInstanceOf(
      ValidationError,
    )
  })
})
