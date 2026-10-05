/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Onde a conversa fica DEPOIS que o pedido é confirmado.
 *
 * Era `greeting`, e com isso toda mensagem seguinte reabria o menu de boas-vindas: o cliente que
 * escolheu um produto substituto e respondeu "ok" foi convidado a fazer o pedido de novo, com o
 * pedido dele em separação. O estado é a correção, e este teste é o que impede a volta — nenhum
 * outro cobria o estado final deste caminho.
 */

import { describe, expect, it } from 'bun:test'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { Customer } from '@/infra/database/schema'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { CONFIRMING_BUTTON_ID } from '@/modules/conversation/shared/Messages.constant'
import { DELIVERY_TYPE, PAYMENT_METHOD, RECEIPT_PREFERENCE } from '@/modules/order/shared/Order.constant'
import { CheckoutHandler, type CheckoutHandlerDependencies } from './CheckoutHandler'

const PHONE = '5511988887777'
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

function buildDependencies() {
  const stateUpdates: { currentState: string }[] = []

  const dependencies = {
    orderRealtimeNotifier: { notifyOrderChanged: () => undefined },
    conversationSessionRepository: {
      async updateStateByPhone(params: { currentState: string }) {
        stateUpdates.push({ currentState: params.currentState })
        return undefined
      },
    },
    whatsAppSender: {
      async sendText() {},
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
        return {
          order: {
            id: 'order-1',
            shortCode: 'ABC123',
            deliveryType: DELIVERY_TYPE.DELIVERY,
            address: { cep: '01001000' },
            cashChangeForInCents: null,
            totalInCents: 5000,
            deliveryFeeInCents: 0,
          },
        }
      },
    },
    resolveOrderDeliveryEstimateUseCase: {
      async execute() {
        return undefined
      },
    },
    addressLookupProvider: {},
    storePreparationMinutes: 25,
  } as unknown as CheckoutHandlerDependencies

  return { dependencies, stateUpdates }
}

describe('CheckoutHandler.confirmOrder — onde a conversa estaciona', () => {
  it('estaciona em `completed`, não na saudação', async () => {
    const { dependencies, stateUpdates } = buildDependencies()
    const handler = new CheckoutHandler(dependencies)

    await handler.handle({
      session: buildSession(),
      customer: CUSTOMER,
      message: { kind: 'button_reply', buttonId: CONFIRMING_BUTTON_ID.CONFIRM } as never,
    })

    expect(stateUpdates).toHaveLength(1)
    expect(stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.COMPLETED)
    expect(stateUpdates[0]?.currentState).not.toBe(CONVERSATION_STATE.GREETING)
  })
})
