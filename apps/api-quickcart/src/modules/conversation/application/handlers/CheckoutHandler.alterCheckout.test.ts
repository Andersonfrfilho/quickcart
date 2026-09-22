/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * T2.3 — botão "Alterar" no resumo antes de confirmar: volta ao `cart_review` sem apagar o
 * carrinho persistido nem o contexto de checkout já escolhido nesta sessão. Cobre só
 * `handleConfirming` com o botão de editar; o restante do estado `confirming` (Confirmar/Cancelar)
 * tem cobertura própria em `CheckoutHandler.test.ts`.
 */

import { describe, expect, it } from 'bun:test'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { Customer } from '@/infra/database/schema'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import {
  CONFIRMING_BUTTON_ID,
  DELIVERY_TYPE_BUTTON_ID,
  MESSAGES,
  PAYMENT_METHOD_BUTTON_ID,
  RECEIPT_PREFERENCE_BUTTON_ID,
} from '@/modules/conversation/shared/Messages.constant'
import { CheckoutHandler, type CheckoutHandlerDependencies } from './CheckoutHandler'

const PHONE = '5511988887777'
const CUSTOMER_ID = 'customer-1'
const CART_ID = 'cart-1'

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
    currentState: CONVERSATION_STATE.CONFIRMING,
    context: {},
    mode: 'bot',
    lastInteractionAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function buildDependencies(hasCart = true) {
  const texts: string[] = []
  const buttonMessages: { body: string; buttons: readonly { id: string; title: string }[] }[] = []
  const stateUpdates: { currentState: string; context: Record<string, unknown> }[] = []

  const dependencies = {
    conversationSessionRepository: {
      async updateStateByPhone(params: { currentState: string; context: Record<string, unknown> }) {
        stateUpdates.push({ currentState: params.currentState, context: params.context ?? {} })
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
        return hasCart ? { id: CART_ID } : undefined
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
    resolveOrderDeliveryEstimateUseCase: {},
    addressLookupProvider: {},
    storePreparationMinutes: 30,
    configuredDeliveryFeeInCents: 0,
  } as unknown as CheckoutHandlerDependencies

  return { dependencies, texts, buttonMessages, stateUpdates }
}

const CHECKOUT_CONTEXT = {
  checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY,
  checkoutDeliveryFeeInCents: 0,
  checkoutAddress: { street: 'Rua X', number: '123', neighborhood: 'Centro', city: 'Franca', state: 'SP', zipCode: '14400-000' },
  checkoutPaymentMethod: PAYMENT_METHOD_BUTTON_ID.CASH,
  checkoutCashChangeForInCents: 1000,
  checkoutReceiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP,
}

describe('CheckoutHandler.handleConfirming — botão "Alterar" (T2.3)', () => {
  it('volta ao cart_review sem apagar o carrinho, preservando o contexto de checkout como remembered', async () => {
    const { dependencies, buttonMessages, stateUpdates } = buildDependencies()
    const handler = new CheckoutHandler(dependencies)

    await handler.handle({
      session: buildSession({ context: CHECKOUT_CONTEXT }),
      customer: CUSTOMER,
      message: {
        kind: 'button_reply',
        from: PHONE,
        waMessageId: 'wa-1',
        buttonId: CONFIRMING_BUTTON_ID.EDIT,
        buttonTitle: '✏️ Alterar',
      },
    })

    expect(stateUpdates).toEqual([
      {
        currentState: CONVERSATION_STATE.CART_REVIEW,
        context: {
          rememberedCheckout: {
            deliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY,
            address: CHECKOUT_CONTEXT.checkoutAddress,
            paymentMethod: PAYMENT_METHOD_BUTTON_ID.CASH,
            receiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP,
          },
        },
      },
    ])

    // Reaproveita sendCartSummary (não duplica a montagem do resumo do carrinho).
    expect(buttonMessages).toHaveLength(1)
    expect(buttonMessages[0]?.body).toContain(MESSAGES.CART_SUMMARY_HEADER)
  })

  it('carrinho vazio (sem cart aberto) não apaga o rememberedCheckout já calculado, só avisa', async () => {
    const { dependencies, texts, stateUpdates } = buildDependencies(false)
    const handler = new CheckoutHandler(dependencies)

    await handler.handle({
      session: buildSession({ context: CHECKOUT_CONTEXT }),
      customer: CUSTOMER,
      message: {
        kind: 'button_reply',
        from: PHONE,
        waMessageId: 'wa-1',
        buttonId: CONFIRMING_BUTTON_ID.EDIT,
        buttonTitle: '✏️ Alterar',
      },
    })

    expect(stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.CART_REVIEW)
    expect(texts).toEqual([MESSAGES.CART_EMPTY])
  })
})
