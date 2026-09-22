/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * T2.3 — depois de "Alterar", o `rememberedCheckout` já vive na sessão (não em pedido
 * confirmado). `handleCartReview` precisa priorizar esse valor sobre a leitura do último
 * pedido do banco ao fechar o pedido de novo.
 */

import { describe, expect, it } from 'bun:test'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { Customer } from '@/infra/database/schema'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { CART_REVIEW_BUTTON_ID, DELIVERY_TYPE_BUTTON_ID, PAYMENT_METHOD_BUTTON_ID, RECEIPT_PREFERENCE_BUTTON_ID } from '@/modules/conversation/shared/Messages.constant'
import { CartHandler, type CartHandlerDependencies } from './CartHandler'

const PHONE = '5511988887777'
const CUSTOMER_ID = 'customer-1'

const CUSTOMER: Customer = {
  id: CUSTOMER_ID,
  phone: PHONE,
  name: 'Cliente Teste',
  email: null,
  userId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function buildSession(overrides: Partial<ConversationSession> = {}): ConversationSession {
  return {
    id: 'session-1',
    customerPhone: PHONE,
    currentState: CONVERSATION_STATE.CART_REVIEW,
    context: {},
    mode: 'bot',
    lastInteractionAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('CartHandler.handleCartReview — reaproveitamento após "Alterar" (T2.3)', () => {
  it('usa o rememberedCheckout da sessão (vindo do Alterar) sem consultar o último pedido do banco', async () => {
    const stateUpdates: { currentState: string; context: Record<string, unknown> }[] = []
    const buttonMessages: { body: string }[] = []
    let findLastByCustomerCalls = 0

    const dependencies = {
      conversationSessionRepository: {
        async updateStateByPhone(params: { currentState: string; context: Record<string, unknown> }) {
          stateUpdates.push({ currentState: params.currentState, context: params.context ?? {} })
          return undefined
        },
      },
      whatsAppSender: {
        async sendText() {},
        async sendInteractiveButtons(_phone: string, body: string) {
          buttonMessages.push({ body })
        },
      },
      cartRepository: {},
      productRepository: {},
      removeCartItemUseCase: {},
      updateCartItemQuantityUseCase: {},
      orderRepository: {
        async findLastByCustomer() {
          findLastByCustomerCalls += 1
          return undefined
        },
      },
    } as unknown as CartHandlerDependencies

    const handler = new CartHandler(dependencies)
    const rememberedFromAlter = {
      deliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY,
      paymentMethod: PAYMENT_METHOD_BUTTON_ID.CASH,
      receiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP,
    }

    await handler.handle({
      session: buildSession({ context: { rememberedCheckout: rememberedFromAlter } }),
      customer: CUSTOMER,
      message: {
        kind: 'button_reply',
        from: PHONE,
        waMessageId: 'wa-1',
        buttonId: CART_REVIEW_BUTTON_ID.CHECKOUT,
        buttonTitle: '✅ Fechar pedido',
      },
    })

    expect(findLastByCustomerCalls).toBe(0)
    expect(stateUpdates).toEqual([
      { currentState: CONVERSATION_STATE.AWAITING_DELIVERY_TYPE, context: { rememberedCheckout: rememberedFromAlter } },
    ])
    expect(buttonMessages).toHaveLength(1)
  })
})
