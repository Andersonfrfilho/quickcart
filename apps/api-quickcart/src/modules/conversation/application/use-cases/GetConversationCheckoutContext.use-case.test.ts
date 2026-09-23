/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { describe, expect, it } from 'bun:test'

import type { Customer, Product } from '@/infra/database/schema'
import type { CartItemRecord, CartRecord } from '@/modules/cart/domain/CartRepository.interface'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import { GetConversationCheckoutContextUseCase } from './GetConversationCheckoutContext.use-case'

const PHONE = '5511999990000'
const CUSTOMER_ID = '11111111-1111-4111-8111-111111111111'
const CART_ID = '22222222-2222-4222-8222-222222222222'
const RICE_ID = '33333333-3333-4333-8333-333333333333'
const BEANS_ID = '44444444-4444-4444-8444-444444444444'
const NOW = new Date('2026-09-21T12:00:00Z')

type Scenario = {
  readonly context?: Record<string, unknown>
  readonly hasCart?: boolean
}

function buildUseCase(scenario: Scenario): GetConversationCheckoutContextUseCase {
  const session: ConversationSession = {
    id: 'session-1',
    customerPhone: PHONE,
    currentState: 'checkout',
    context: scenario.context ?? {},
    mode: 'bot',
    humanRequestedAt: null,
    lastInteractionAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  }
  const customer = { id: CUSTOMER_ID, phone: PHONE } as Customer
  const cart: CartRecord = { id: CART_ID, shortCode: 'LC-1000', customerId: CUSTOMER_ID, channel: 'whatsapp', status: 'open', createdAt: NOW, updatedAt: NOW }
  const cartItem = (productId: string, quantity: number): CartItemRecord => ({
    id: `item-${productId}`,
    cartId: CART_ID,
    productId,
    quantity,
    matchType: 'auto',
    originalTerm: null,
    createdAt: NOW,
    updatedAt: NOW,
  })
  const products = [
    { id: RICE_ID, name: 'Arroz 5kg', priceInCents: 2490 },
    { id: BEANS_ID, name: 'Feijão 1kg', priceInCents: 899 },
  ] as Product[]

  return new GetConversationCheckoutContextUseCase({
    conversationSessionRepository: { findByPhone: async () => session },
    customerRepository: { findByPhone: async () => customer },
    cartRepository: {
      findOpenByCustomer: async () => (scenario.hasCart ? cart : undefined),
      listItems: async () => [cartItem(RICE_ID, 2), cartItem(BEANS_ID, 1)],
    },
    productRepository: { findByIds: async () => products },
  })
}

const FULL_CHECKOUT_CONTEXT = {
  customerName: 'Maria da Silva',
  checkoutEmail: 'maria@example.com',
  checkoutDeliveryType: 'delivery',
  checkoutDeliveryFeeInCents: 800,
  checkoutDeliveryDistanceKm: 6.4,
  checkoutDeliveryTierMaxKm: 8,
  checkoutDeliveryLocationSource: 'cep',
  checkoutAddress: { cep: '01001000', street: 'Praça da Sé', number: '10', neighborhood: 'Sé', city: 'São Paulo', state: 'SP' },
  checkoutPaymentMethod: 'cash',
  checkoutCashChangeForInCents: 10000,
}

describe('GetConversationCheckoutContextUseCase', () => {
  it('sem carrinho aberto e sem checkout não há pedido em andamento', async () => {
    const result = await buildUseCase({ hasCart: false, context: { cartDraft: [] } }).execute({ whatsappNumber: PHONE })
    expect(result).toBeUndefined()
  })

  it('sessão esperando a confirmação do endereço aproximado: taxa ainda não cotada, resumo intacto', async () => {
    const result = await buildUseCase({
      hasCart: true,
      context: {
        checkoutDeliveryType: 'delivery',
        checkoutAddress: { cep: '01001000', street: 'Praça da Sé', number: '10', neighborhood: 'Sé', city: 'São Paulo', state: 'SP' },
        checkoutApproximateDecision: { feeInCents: 1000, tierMaxKm: 8, tierFeeInCents: 1000 },
      },
    }).execute({ whatsappNumber: PHONE })

    expect(result?.deliveryFeeInCents).toBeNull()
    expect(result?.deliveryTierMaxKm).toBeNull()
    expect(result?.deliveryLocationSource).toBeNull()
    expect(result?.items).toHaveLength(2)
    expect(result?.amountDueInCents).toBe(2490 * 2 + 899)
    expect(JSON.stringify(result)).not.toContain('checkoutApproximateDecision')
  })

  it('monta itens da tabela carts e soma a taxa do CONTEXTO no total devido', async () => {
    const result = await buildUseCase({ hasCart: true, context: FULL_CHECKOUT_CONTEXT }).execute({ whatsappNumber: PHONE })

    expect(result).toEqual({
      items: [
        { name: 'Arroz 5kg', quantity: 2, lineTotalInCents: 4980 },
        { name: 'Feijão 1kg', quantity: 1, lineTotalInCents: 899 },
      ],
      subtotalInCents: 5879,
      deliveryType: 'delivery',
      deliveryFeeInCents: 800,
      deliveryDistanceKm: 6.4,
      deliveryTierMaxKm: 8,
      deliveryLocationSource: 'cep',
      amountDueInCents: 6679,
      address: 'Praça da Sé, 10 — Sé, São Paulo/SP',
      paymentMethod: 'cash',
      cashChangeForInCents: 10000,
    })
  })

  it('não vaza chaves do contexto além do recorte do card', async () => {
    const result = await buildUseCase({ hasCart: true, context: FULL_CHECKOUT_CONTEXT }).execute({ whatsappNumber: PHONE })
    const serialized = JSON.stringify(result)

    expect(serialized).not.toContain('Maria')
    expect(serialized).not.toContain('maria@example.com')
    expect(serialized).not.toContain('01001000')
    expect(Object.keys(result ?? {}).sort()).toEqual(
      [
        'address',
        'amountDueInCents',
        'cashChangeForInCents',
        'deliveryDistanceKm',
        'deliveryFeeInCents',
        'deliveryLocationSource',
        'deliveryTierMaxKm',
        'deliveryType',
        'items',
        'paymentMethod',
        'subtotalInCents',
      ],
    )
  })

  it('sessão anterior ao deploy (entrega sem cotação por faixa): card mostra "a calcular", sem inventar taxa nem faixa', async () => {
    const result = await buildUseCase({
      hasCart: true,
      context: { checkoutDeliveryType: 'delivery', checkoutPaymentMethod: 'cash' },
    }).execute({ whatsappNumber: PHONE })

    expect(result?.deliveryFeeInCents).toBeNull()
    expect(result?.deliveryTierMaxKm).toBeNull()
    expect(result?.deliveryDistanceKm).toBeNull()
    expect(result?.deliveryLocationSource).toBeNull()
    // Sem taxa cotada, "total devido" ainda soma 0 por segurança de tipo, mas o card (T3.3) usa
    // `deliveryFeeInCents === null` para rotular como "Subtotal (sem entrega)", não "Total".
    expect(result?.amountDueInCents).toBe(5879)
  })

  it('entrega cotada com faixa aproximada (D3): sem distância, com o teto da faixa', async () => {
    const result = await buildUseCase({
      hasCart: true,
      context: {
        checkoutDeliveryType: 'delivery',
        checkoutPaymentMethod: 'cash',
        checkoutDeliveryFeeInCents: 1000,
        checkoutDeliveryTierMaxKm: 8,
        checkoutDeliveryLocationSource: 'cep_approximate',
      },
    }).execute({ whatsappNumber: PHONE })

    expect(result?.deliveryFeeInCents).toBe(1000)
    expect(result?.deliveryTierMaxKm).toBe(8)
    expect(result?.deliveryDistanceKm).toBeNull()
    expect(result?.deliveryLocationSource).toBe('cep_approximate')
  })

  it('retirada: faixa e distância nulas mesmo que sobrem no contexto de uma entrega anterior', async () => {
    const result = await buildUseCase({
      hasCart: true,
      context: {
        checkoutDeliveryType: 'pickup',
        checkoutDeliveryTierMaxKm: 8,
        checkoutDeliveryDistanceKm: 3,
        checkoutDeliveryLocationSource: 'cep',
      },
    }).execute({ whatsappNumber: PHONE })

    expect(result?.deliveryFeeInCents).toBe(0)
    expect(result?.deliveryTierMaxKm).toBeNull()
    expect(result?.deliveryDistanceKm).toBeNull()
    expect(result?.deliveryLocationSource).toBeNull()
  })

  it('card do painel não leva o CEP no endereço (S3)', async () => {
    const result = await buildUseCase({ hasCart: true, context: FULL_CHECKOUT_CONTEXT }).execute({ whatsappNumber: PHONE })

    expect(result?.address).not.toContain('01001')
  })

  it('a resposta da API não contém latitude/longitude nem CEP em nenhum campo (T3.3)', async () => {
    const result = await buildUseCase({
      hasCart: true,
      context: {
        ...FULL_CHECKOUT_CONTEXT,
        checkoutLocationDraft: { latitude: -23.55, longitude: -46.63 },
      },
    }).execute({ whatsappNumber: PHONE })

    const serialized = JSON.stringify(result)
    expect(serialized).not.toMatch(/latitude|longitude/i)
    expect(serialized).not.toContain('01001000')
  })

  it('carrinho ainda sem checkout: retirada/pagamento nulos, taxa e faixa nulas', async () => {
    const result = await buildUseCase({ hasCart: true }).execute({ whatsappNumber: PHONE })

    expect(result?.deliveryType).toBeNull()
    // Sem tipo de entrega escolhido, `resolveCheckoutDeliveryFeeInCents` trata como não-entrega (0),
    // igual à retirada — só a entrega SEM cotação (checkoutDeliveryType: 'delivery' sem fonte) é `null`.
    expect(result?.deliveryFeeInCents).toBe(0)
    expect(result?.deliveryTierMaxKm).toBeNull()
    expect(result?.deliveryDistanceKm).toBeNull()
    expect(result?.deliveryLocationSource).toBeNull()
    expect(result?.amountDueInCents).toBe(5879)
    expect(result?.address).toBeNull()
    expect(result?.paymentMethod).toBeNull()
  })
})
