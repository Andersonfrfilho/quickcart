/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cobre só `withAllowedTransitions` — o ponto único de serialização de pedido para fora da api
 * (lista, detalhe e as respostas de mutação), onde `requiresCardMachine` entra no DTO.
 */

import { describe, expect, it } from 'bun:test'
import { TokenService } from '@adatechnology/user-module'

import { environment } from '@/infra/config/environment'
import type { ParsedRequest, ResponseHelper } from '@/infra/http/router'
import { DELIVERY_TYPE, PAYMENT_METHOD } from '@/modules/order/shared/Order.constant'
import { QUICKCART_ROLE } from '@/modules/user/shared/User.constant'
import { OrderController, withAllowedTransitions } from './Order.controller'

describe('withAllowedTransitions', () => {
  it('expõe requiresCardMachine = true no pedido de entrega com cartão na entrega', () => {
    const order = withAllowedTransitions({
      status: 'pending_confirmation',
      deliveryType: DELIVERY_TYPE.DELIVERY,
      paymentMethod: PAYMENT_METHOD.CARD_ON_DELIVERY,
      deliveryFailureReason: null,
      totalInCents: 5000,
      deliveryFeeInCents: 0,
    })

    expect(order.requiresCardMachine).toBe(true)
  })

  it('expõe requiresCardMachine = false na retirada com cartão na entrega', () => {
    const order = withAllowedTransitions({
      status: 'pending_confirmation',
      deliveryType: DELIVERY_TYPE.PICKUP,
      paymentMethod: PAYMENT_METHOD.CARD_ON_DELIVERY,
      deliveryFailureReason: null,
      totalInCents: 5000,
      deliveryFeeInCents: 0,
    })

    expect(order.requiresCardMachine).toBe(false)
  })

  it('expõe amountDueInCents = itens + taxa, sem mexer em totalInCents', () => {
    const order = withAllowedTransitions({
      status: 'pending_confirmation',
      deliveryType: DELIVERY_TYPE.DELIVERY,
      paymentMethod: PAYMENT_METHOD.PIX,
      deliveryFailureReason: null,
      totalInCents: 13250,
      deliveryFeeInCents: 800,
    })

    expect(order.totalInCents).toBe(13250)
    expect(order.deliveryFeeInCents).toBe(800)
    expect(order.amountDueInCents).toBe(14050)
  })
})

const ORDER_WITH_LOCATION = {
  id: 'order-1',
  shortCode: 'ABC123',
  status: 'pending_confirmation',
  deliveryType: DELIVERY_TYPE.DELIVERY,
  paymentMethod: PAYMENT_METHOD.PIX,
  deliveryFailureReason: null,
  totalInCents: 5000,
  deliveryFeeInCents: 500,
  address: { latitude: -23.55, longitude: -46.65, number: '10', complement: 'casa' },
}

const tokenService = new TokenService({
  secret: environment.USER_ACCESS_TOKEN_SECRET,
  issuer: 'quickcart',
  audience: 'quickcart',
})

async function buildRequest(params: { readonly role?: string; readonly query?: string } = {}): Promise<ParsedRequest> {
  const headers: Record<string, string> = { 'idempotency-key': 'key-1' }
  if (params.role) {
    const { accessToken } = await tokenService.sign({
      id: '44444444-4444-4444-8444-444444444444',
      email: 'pessoa@quickcart.test',
      name: 'Pessoa',
      role: params.role,
      isActive: true,
    })
    headers.authorization = `Bearer ${accessToken}`
  }
  return {
    method: 'GET',
    url: '/v1/orders',
    query: new URLSearchParams(params.query ?? ''),
    headers,
    params: ['ABC123'],
    body: undefined,
    rawBody: Buffer.from(''),
  } as unknown as ParsedRequest
}

function buildResponseSpy() {
  const payloads: unknown[] = []
  const response = {
    json(_statusCode: number, payload: unknown) {
      payloads.push(payload)
    },
  } as unknown as ResponseHelper
  return { response, payloads }
}

function buildController(): OrderController {
  const orderResult = { order: ORDER_WITH_LOCATION, items: [] }
  return new OrderController({
    createWebOrderUseCase: {} as never,
    getOrderByShortCodeUseCase: { execute: async () => orderResult } as never,
    listOrdersUseCase: {
      execute: async () => ({ items: [ORDER_WITH_LOCATION], total: 1, page: 1, perPage: 20 }),
    } as never,
    updateOrderStatusUseCase: {} as never,
    getAdminOrderDetailUseCase: {
      execute: async () => ({ ...orderResult, deliveryAttempts: [] }),
    } as never,
    setOrderItemUnavailableUseCase: {} as never,
    setOrderItemPickedUseCase: {} as never,
    notifyUnavailableItemsUseCase: {} as never,
    customerRepository: {} as never,
  })
}

function expectNoCoordinates(payload: unknown): void {
  const serialized = JSON.stringify(payload)
  expect(serialized).not.toContain('latitude')
  expect(serialized).not.toContain('longitude')
  // O resto do endereço continua — o entregador precisa do número.
  expect(serialized).toContain('"number":"10"')
}

describe('OrderController — coordenada fora de toda resposta (LGPD)', () => {
  it('GET público /orders/:shortCode não devolve latitude/longitude', async () => {
    const { response, payloads } = buildResponseSpy()
    await buildController().handleGetByShortCode(await buildRequest({ query: 'phone=11999998888' }), response)
    expectNoCoordinates(payloads[0])
  })

  it('lista admin não devolve latitude/longitude', async () => {
    const { response, payloads } = buildResponseSpy()
    await buildController().handleListAdmin(await buildRequest({ role: QUICKCART_ROLE.ADMIN }), response)
    expectNoCoordinates(payloads[0])
  })

  it('detalhe admin não devolve latitude/longitude', async () => {
    const { response, payloads } = buildResponseSpy()
    await buildController().handleGetAdminDetail(await buildRequest({ role: QUICKCART_ROLE.ADMIN }), response)
    expectNoCoordinates(payloads[0])
  })

  it('withAllowedTransitions (respostas de mutação) também remove a coordenada', () => {
    expectNoCoordinates(withAllowedTransitions(ORDER_WITH_LOCATION))
  })
})
