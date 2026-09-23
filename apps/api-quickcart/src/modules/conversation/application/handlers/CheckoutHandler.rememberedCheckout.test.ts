/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Correção T1.1/T1.2: o atalho "Isso mesmo" (checkout lembrado) não pode pular a pergunta
 * do troco quando o pagamento lembrado é dinheiro, nem o aviso da maquininha quando é
 * cartão na entrega. Cobre só `handleAwaitingDeliveryType` com `rememberedCheckout` no
 * contexto — o restante do checkout tem cobertura própria em `CheckoutHandler.test.ts`.
 */

import { describe, expect, it } from 'bun:test'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import {
  DELIVERY_TYPE_BUTTON_ID,
  MESSAGES,
  PAYMENT_METHOD_BUTTON_ID,
  REMEMBERED_CHECKOUT_BUTTON_ID,
} from '@/modules/conversation/shared/Messages.constant'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'
import type { QuoteDeliveryFeeResult } from '@/modules/order/application/types/QuoteDeliveryFee.types'
import { DELIVERY_LOCATION_SOURCE, DELIVERY_QUOTE_KIND } from '@/modules/order/shared/DeliveryFeeQuote.constant'
import { CheckoutHandler, type CheckoutHandlerDependencies } from './CheckoutHandler'

const PHONE = '5511988887777'
const CUSTOMER_ID = 'customer-1'
const CART_ID = 'cart-1'

function buildSession(overrides: Partial<ConversationSession> = {}): ConversationSession {
  return {
    id: 'session-1',
    customerPhone: PHONE,
    currentState: CONVERSATION_STATE.AWAITING_DELIVERY_TYPE,
    context: {},
    mode: 'bot',
    lastInteractionAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function buildDependencies() {
  const texts: string[] = []
  const buttonMessages: { body: string; buttons: readonly { id: string; title: string }[] }[] = []
  const stateUpdates: { currentState: string; context: Record<string, unknown> }[] = []

  const dependencies = {
    orderRealtimeNotifier: { notifyOrderChanged: () => undefined },
    conversationSessionRepository: {
      async updateStateByPhone(params: { currentState: string; context: Record<string, unknown> }) {
        stateUpdates.push({ currentState: params.currentState, context: params.context })
        return undefined
      },
    },
    whatsAppSender: {
      async sendText(_phone: string, text: string) {
        texts.push(text)
      },
      async sendInteractiveButtons(_phone: string, body: string, buttons: readonly { id: string; title: string }[]) {
        buttonMessages.push({ body, buttons })
      },
    },
    cartRepository: {
      async findOpenByCustomer() {
        return { id: CART_ID }
      },
      async listItems() {
        return [{ productId: 'product-1', quantity: 2 }]
      },
    },
    productRepository: {
      async findById() {
        return { name: 'Arroz 5kg', priceInCents: 5000 }
      },
    },
    customerRepository: {},
    createOrderFromCartUseCase: {},
    addressLookupProvider: {},
    // Entrega lembrada é recotada (T3.1): aqui a faixa atual cobre o endereço lembrado.
    quoteDeliveryFeeUseCase: {
      async execute(): Promise<QuoteDeliveryFeeResult> {
        return QUOTED_RESULT
      },
    },
  } as unknown as CheckoutHandlerDependencies

  return { dependencies, texts, buttonMessages, stateUpdates }
}

const REMEMBERED_ADDRESS = { cep: '01001000', street: 'Praça da Sé', number: '10', neighborhood: 'Sé', city: 'São Paulo', state: 'SP' }

const QUOTED_RESULT: QuoteDeliveryFeeResult = {
  kind: DELIVERY_QUOTE_KIND.QUOTED,
  feeInCents: 800,
  distanceKm: 2.4,
  tier: { maxDistanceKm: 3, feeInCents: 800 },
  source: DELIVERY_LOCATION_SOURCE.CEP,
}

const QUOTED_MESSAGE = MESSAGES.CHECKOUT_DELIVERY_FEE_QUOTED.replace('{distancia}', '2,4').replace('{valor}', formatPriceInCents(800))

function buildRememberedContext(paymentMethod: string, deliveryType: string) {
  return {
    rememberedCheckout: {
      deliveryType,
      ...(deliveryType === DELIVERY_TYPE_BUTTON_ID.DELIVERY ? { address: REMEMBERED_ADDRESS } : {}),
      paymentMethod,
      receiptPreference: 'whatsapp',
    },
  }
}

describe('CheckoutHandler.handleAwaitingDeliveryType — atalho "Isso mesmo" (checkout lembrado)', () => {
  it('dinheiro lembrado pergunta o troco, não confirma direto', async () => {
    const { dependencies, texts, buttonMessages, stateUpdates } = buildDependencies()
    const handler = new CheckoutHandler(dependencies)

    await handler.handle({
      session: buildSession({ context: buildRememberedContext(PAYMENT_METHOD_BUTTON_ID.CASH, DELIVERY_TYPE_BUTTON_ID.DELIVERY) }),
      customer: { id: CUSTOMER_ID } as never,
      message: {
        kind: 'button_reply',
        from: PHONE,
        waMessageId: 'wa-1',
        buttonId: REMEMBERED_CHECKOUT_BUTTON_ID.SAME_AS_LAST,
        buttonTitle: '✅ Isso mesmo',
      },
    })

    expect(stateUpdates).toEqual([
      {
        currentState: CONVERSATION_STATE.AWAITING_CASH_CHANGE,
        context: {
          checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY,
          checkoutDeliveryFeeInCents: 800,
          checkoutDeliveryDistanceKm: 2.4,
          checkoutDeliveryTierMaxKm: 3,
          checkoutDeliveryTierFeeInCents: 800,
          checkoutDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.CEP,
          checkoutAddress: REMEMBERED_ADDRESS,
          checkoutPaymentMethod: PAYMENT_METHOD_BUTTON_ID.CASH,
          checkoutReceiptPreference: 'whatsapp',
        },
      },
    ])
    expect(buttonMessages).toHaveLength(1)
    expect(buttonMessages[0]?.body).toBe(MESSAGES.CHECKOUT_ASK_CASH_CHANGE)
    expect(texts).toEqual([QUOTED_MESSAGE])
  })

  it('cartão na entrega lembrado + entrega envia o aviso da maquininha e confirma', async () => {
    const { dependencies, texts, buttonMessages, stateUpdates } = buildDependencies()
    const handler = new CheckoutHandler(dependencies)

    await handler.handle({
      session: buildSession({
        context: buildRememberedContext(PAYMENT_METHOD_BUTTON_ID.CARD_ON_DELIVERY, DELIVERY_TYPE_BUTTON_ID.DELIVERY),
      }),
      customer: { id: CUSTOMER_ID } as never,
      message: {
        kind: 'button_reply',
        from: PHONE,
        waMessageId: 'wa-1',
        buttonId: REMEMBERED_CHECKOUT_BUTTON_ID.SAME_AS_LAST,
        buttonTitle: '✅ Isso mesmo',
      },
    })

    expect(texts).toEqual([QUOTED_MESSAGE, MESSAGES.CHECKOUT_CARD_ON_DELIVERY_MACHINE_NOTICE])
    expect(stateUpdates).toEqual([{ currentState: CONVERSATION_STATE.CONFIRMING, context: expect.any(Object) }])
    expect(buttonMessages).toHaveLength(1)
  })

  it('cartão na entrega lembrado + retirada NÃO envia o aviso da maquininha', async () => {
    const { dependencies, texts, stateUpdates } = buildDependencies()
    const handler = new CheckoutHandler(dependencies)

    await handler.handle({
      session: buildSession({
        context: buildRememberedContext(PAYMENT_METHOD_BUTTON_ID.CARD_ON_DELIVERY, DELIVERY_TYPE_BUTTON_ID.PICKUP),
      }),
      customer: { id: CUSTOMER_ID } as never,
      message: {
        kind: 'button_reply',
        from: PHONE,
        waMessageId: 'wa-1',
        buttonId: REMEMBERED_CHECKOUT_BUTTON_ID.SAME_AS_LAST,
        buttonTitle: '✅ Isso mesmo',
      },
    })

    expect(texts).toEqual([])
    expect(stateUpdates).toEqual([{ currentState: CONVERSATION_STATE.CONFIRMING, context: expect.any(Object) }])
  })

  it('pix lembrado confirma direto, sem perguntar nada', async () => {
    const { dependencies, texts, stateUpdates } = buildDependencies()
    const handler = new CheckoutHandler(dependencies)

    await handler.handle({
      session: buildSession({
        context: buildRememberedContext(PAYMENT_METHOD_BUTTON_ID.PIX, DELIVERY_TYPE_BUTTON_ID.DELIVERY),
      }),
      customer: { id: CUSTOMER_ID } as never,
      message: {
        kind: 'button_reply',
        from: PHONE,
        waMessageId: 'wa-1',
        buttonId: REMEMBERED_CHECKOUT_BUTTON_ID.SAME_AS_LAST,
        buttonTitle: '✅ Isso mesmo',
      },
    })

    expect(texts).toEqual([QUOTED_MESSAGE])
    expect(stateUpdates).toEqual([{ currentState: CONVERSATION_STATE.CONFIRMING, context: expect.any(Object) }])
  })
})
