/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cobre só `handleAwaitingPayment` — o resto do checkout (endereço, recibo, confirmação) tem
 * cobertura própria via `CreateOrderFromCart` e `CashChangeHandler`.
 */

import { describe, expect, it } from 'bun:test'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { DELIVERY_TYPE_BUTTON_ID, MESSAGES, PAYMENT_METHOD_BUTTON_ID } from '@/modules/conversation/shared/Messages.constant'
import { CheckoutHandler, type CheckoutHandlerDependencies } from './CheckoutHandler'

const PHONE = '5511988887777'

function buildSession(overrides: Partial<ConversationSession> = {}): ConversationSession {
  return {
    id: 'session-1',
    customerPhone: PHONE,
    currentState: CONVERSATION_STATE.AWAITING_PAYMENT,
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
    cartRepository: {},
    productRepository: {},
    customerRepository: {},
    createOrderFromCartUseCase: {},
    addressLookupProvider: {},
  } as unknown as CheckoutHandlerDependencies

  return { dependencies, texts, buttonMessages, stateUpdates }
}

describe('CheckoutHandler.handleAwaitingPayment — Cartão na entrega', () => {
  it('entrega: envia o aviso da maquininha antes de seguir para o recibo', async () => {
    const { dependencies, texts, buttonMessages } = buildDependencies()
    const handler = new CheckoutHandler(dependencies)

    await handler.handle({
      session: buildSession({ context: { checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY } }),
      customer: { id: 'customer-1' } as never,
      message: {
        kind: 'button_reply',
        from: PHONE,
        waMessageId: 'wa-1',
        buttonId: PAYMENT_METHOD_BUTTON_ID.CARD_ON_DELIVERY,
        buttonTitle: '💳 Cartão na entrega',
      },
    })

    expect(texts).toEqual([MESSAGES.CHECKOUT_CARD_ON_DELIVERY_MACHINE_NOTICE])
    expect(buttonMessages).toHaveLength(1)
    expect(buttonMessages[0]?.body).toBe(MESSAGES.CHECKOUT_ASK_RECEIPT_PREFERENCE)
  })

  it('retirada: não envia o aviso da maquininha', async () => {
    const { dependencies, texts, buttonMessages } = buildDependencies()
    const handler = new CheckoutHandler(dependencies)

    await handler.handle({
      session: buildSession({ context: { checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.PICKUP } }),
      customer: { id: 'customer-1' } as never,
      message: {
        kind: 'button_reply',
        from: PHONE,
        waMessageId: 'wa-1',
        buttonId: PAYMENT_METHOD_BUTTON_ID.CARD_ON_DELIVERY,
        buttonTitle: '💳 Cartão na entrega',
      },
    })

    expect(texts).toEqual([])
    expect(buttonMessages).toHaveLength(1)
    expect(buttonMessages[0]?.body).toBe(MESSAGES.CHECKOUT_ASK_RECEIPT_PREFERENCE)
  })

  it('pix não dispara o aviso da maquininha', async () => {
    const { dependencies, texts } = buildDependencies()
    const handler = new CheckoutHandler(dependencies)

    await handler.handle({
      session: buildSession({ context: { checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY } }),
      customer: { id: 'customer-1' } as never,
      message: {
        kind: 'button_reply',
        from: PHONE,
        waMessageId: 'wa-1',
        buttonId: PAYMENT_METHOD_BUTTON_ID.PIX,
        buttonTitle: '💳 Pix',
      },
    })

    expect(texts).toEqual([])
  })
})
