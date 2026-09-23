/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * T1.3 — previsão de entrega na confirmação (roteiro §12, spec §3.3): a linha só aparece com
 * minMinutes/maxMinutes; some sem estimativa; e a falha da estimativa nunca derruba a confirmação.
 */

import { describe, expect, it } from 'bun:test'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { Customer } from '@/infra/database/schema'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { CONFIRMING_BUTTON_ID, MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { DELIVERY_TYPE, PAYMENT_METHOD, RECEIPT_PREFERENCE } from '@/modules/order/shared/Order.constant'
import { CheckoutHandler, type CheckoutHandlerDependencies } from './CheckoutHandler'

const PHONE = '5511988887777'
const STORE_PREPARATION_MINUTES = 25

const CUSTOMER: Customer = { id: 'customer-1', phone: PHONE } as Customer

function buildSession(): ConversationSession {
  return {
    id: 'session-1',
    customerPhone: PHONE,
    currentState: CONVERSATION_STATE.CONFIRMING,
    context: {
      checkoutDeliveryType: DELIVERY_TYPE.DELIVERY,
      checkoutDeliveryFeeInCents: 0,
      checkoutDeliveryLocationSource: 'cep',
      checkoutPaymentMethod: PAYMENT_METHOD.PIX,
      checkoutReceiptPreference: RECEIPT_PREFERENCE.WHATSAPP,
    },
    mode: 'bot',
    lastInteractionAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function buildOrder(overrides: Partial<{ deliveryType: string }> = {}) {
  return {
    id: 'order-1',
    shortCode: 'ABC123',
    deliveryType: overrides.deliveryType ?? DELIVERY_TYPE.DELIVERY,
    address: { cep: '01001000' },
    cashChangeForInCents: null,
    totalInCents: 5000,
    deliveryFeeInCents: 0,
  }
}

function buildDependencies(params: {
  readonly resolveOrderDeliveryEstimateUseCase: { execute: (input: unknown) => Promise<unknown> }
  readonly order?: ReturnType<typeof buildOrder>
}) {
  const texts: string[] = []

  const dependencies = {
    orderRealtimeNotifier: { notifyOrderChanged: () => undefined },
    conversationSessionRepository: {
      async updateStateByPhone() {
        return undefined
      },
    },
    whatsAppSender: {
      async sendText(_phone: string, text: string) {
        texts.push(text)
      },
      async sendInteractiveButtons() {},
    },
    cartRepository: {
      async findOpenByCustomer() {
        return { id: 'cart-1' }
      },
      async listItems() {
        return []
      },
    },
    productRepository: {},
    customerRepository: {},
    createOrderFromCartUseCase: {
      async execute() {
        return { order: params.order ?? buildOrder() }
      },
    },
    resolveOrderDeliveryEstimateUseCase: params.resolveOrderDeliveryEstimateUseCase,
    addressLookupProvider: {},
    storePreparationMinutes: STORE_PREPARATION_MINUTES,
  } as unknown as CheckoutHandlerDependencies

  return { dependencies, texts }
}

describe('CheckoutHandler.confirmOrder — previsão de entrega (T1.3)', () => {
  it('com minMinutes/maxMinutes, a confirmação traz a linha de previsão', async () => {
    const { dependencies, texts } = buildDependencies({
      resolveOrderDeliveryEstimateUseCase: {
        async execute() {
          return { distanceKm: 3, minMinutes: 20, maxMinutes: 35, isApproximate: false, isOutsideRadius: false }
        },
      },
    })
    const handler = new CheckoutHandler(dependencies)

    await handler.handle({
      session: buildSession(),
      customer: CUSTOMER,
      message: { kind: 'button_reply', buttonId: CONFIRMING_BUTTON_ID.CONFIRM } as never,
    })

    expect(texts).toHaveLength(1)
    expect(texts[0]).toContain('Previsão de entrega: entre 20 e 35 minutos.')
  })

  it('sem estimativa (undefined), a linha não aparece e a confirmação sai normalmente', async () => {
    const { dependencies, texts } = buildDependencies({
      resolveOrderDeliveryEstimateUseCase: {
        async execute() {
          return undefined
        },
      },
    })
    const handler = new CheckoutHandler(dependencies)

    await handler.handle({
      session: buildSession(),
      customer: CUSTOMER,
      message: { kind: 'button_reply', buttonId: CONFIRMING_BUTTON_ID.CONFIRM } as never,
    })

    expect(texts).toHaveLength(1)
    expect(texts[0]).not.toContain('Previsão de entrega')
    expect(texts[0]).toContain(MESSAGES.ORDER_CONFIRMED_PREFIX)
  })

  it('estimativa lançando erro: confirmação é enviada mesmo assim, sem a linha', async () => {
    const { dependencies, texts } = buildDependencies({
      resolveOrderDeliveryEstimateUseCase: {
        async execute() {
          throw new Error('mapa fora do ar')
        },
      },
    })
    const handler = new CheckoutHandler(dependencies)

    await handler.handle({
      session: buildSession(),
      customer: CUSTOMER,
      message: { kind: 'button_reply', buttonId: CONFIRMING_BUTTON_ID.CONFIRM } as never,
    })

    expect(texts).toHaveLength(1)
    expect(texts[0]).not.toContain('Previsão de entrega')
    expect(texts[0]).toContain(MESSAGES.ORDER_CONFIRMED_PREFIX)
  })

  it('fora do raio: a linha não aparece', async () => {
    const { dependencies, texts } = buildDependencies({
      resolveOrderDeliveryEstimateUseCase: {
        async execute() {
          return { distanceKm: 30, minMinutes: 60, maxMinutes: 90, isApproximate: false, isOutsideRadius: true }
        },
      },
    })
    const handler = new CheckoutHandler(dependencies)

    await handler.handle({
      session: buildSession(),
      customer: CUSTOMER,
      message: { kind: 'button_reply', buttonId: CONFIRMING_BUTTON_ID.CONFIRM } as never,
    })

    expect(texts[0]).not.toContain('Previsão de entrega')
  })

  it('retirada: mostra a linha de retirada com STORE_PREPARATION_MINUTES, sem chamar a estimativa de rota', async () => {
    let estimateCalled = false
    const { dependencies, texts } = buildDependencies({
      resolveOrderDeliveryEstimateUseCase: {
        async execute() {
          estimateCalled = true
          return undefined
        },
      },
      order: buildOrder({ deliveryType: DELIVERY_TYPE.PICKUP }),
    })
    const handler = new CheckoutHandler(dependencies)

    const session = {
      ...buildSession(),
      context: { ...buildSession().context, checkoutDeliveryType: DELIVERY_TYPE.PICKUP },
    }

    await handler.handle({
      session,
      customer: CUSTOMER,
      message: { kind: 'button_reply', buttonId: CONFIRMING_BUTTON_ID.CONFIRM } as never,
    })

    expect(estimateCalled).toBe(false)
    expect(texts[0]).toContain(`Pronto para retirada em cerca de ${STORE_PREPARATION_MINUTES} minutos.`)
  })
})
