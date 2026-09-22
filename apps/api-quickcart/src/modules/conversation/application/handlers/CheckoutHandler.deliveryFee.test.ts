/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Taxa de entrega no WhatsApp (T2.1, spec §3.4): cotada UMA vez, quando o tipo de entrega é escolhido, e
 * gravada no contexto. O pedido usa esse valor, não a env relida — senão o troco já validado podia ficar
 * menor que o cobrado depois de uma troca de `DELIVERY_FEE_CENTS` no meio do checkout.
 */

import { describe, expect, it } from 'bun:test'

import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { CONFIRMING_BUTTON_ID, DELIVERY_TYPE_BUTTON_ID, MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { DELIVERY_TYPE, PAYMENT_METHOD, RECEIPT_PREFERENCE } from '@/modules/order/shared/Order.constant'
import { CheckoutHandler, type CheckoutHandlerDependencies } from './CheckoutHandler'

const PHONE = '5511988887777'
const CONFIGURED_FEE_IN_CENTS = 800

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

function buildDependencies(configuredDeliveryFeeInCents: number) {
  const texts: string[] = []
  const stateUpdates: { currentState: string; context: Record<string, unknown> }[] = []
  const createOrderCalls: Record<string, unknown>[] = []

  const dependencies = {
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
      async sendInteractiveButtons() {},
    },
    cartRepository: {
      async findOpenByCustomer() {
        return { id: 'cart-1' }
      },
    },
    productRepository: {},
    customerRepository: {},
    createOrderFromCartUseCase: {
      async execute(params: Record<string, unknown>) {
        createOrderCalls.push(params)
        return {
          order: {
            id: 'order-1',
            shortCode: 'QC-1',
            deliveryType: DELIVERY_TYPE.PICKUP,
            totalInCents: 13250,
            deliveryFeeInCents: params.quotedDeliveryFeeInCents,
            cashChangeForInCents: null,
          },
        }
      },
    },
    resolveOrderDeliveryEstimateUseCase: {},
    addressLookupProvider: {},
    storePreparationMinutes: 20,
    configuredDeliveryFeeInCents,
  } as unknown as CheckoutHandlerDependencies

  return { dependencies, texts, stateUpdates, createOrderCalls }
}

function pressButton(buttonId: string) {
  return { kind: 'button_reply', from: PHONE, waMessageId: 'wa-1', buttonId, buttonTitle: '' } as const
}

describe('CheckoutHandler — taxa de entrega cotada no contexto', () => {
  it('entrega grava a taxa configurada no contexto', async () => {
    const { dependencies, stateUpdates } = buildDependencies(CONFIGURED_FEE_IN_CENTS)

    await new CheckoutHandler(dependencies).handle({
      session: buildSession(),
      customer: { id: 'customer-1' } as never,
      message: pressButton(DELIVERY_TYPE_BUTTON_ID.DELIVERY),
    })

    expect(stateUpdates[0]?.context.checkoutDeliveryFeeInCents).toBe(CONFIGURED_FEE_IN_CENTS)
  })

  it('retirada grava taxa 0 mesmo com taxa configurada', async () => {
    const { dependencies, stateUpdates } = buildDependencies(CONFIGURED_FEE_IN_CENTS)

    await new CheckoutHandler(dependencies).handle({
      session: buildSession(),
      customer: { id: 'customer-1' } as never,
      message: pressButton(DELIVERY_TYPE_BUTTON_ID.PICKUP),
    })

    expect(stateUpdates[0]?.context.checkoutDeliveryFeeInCents).toBe(0)
  })

  it('confirmar usa a taxa do contexto, não a configurada agora, e mostra itens + taxa como total', async () => {
    // A env mudou para R$ 12,00 depois que o cliente viu R$ 8,00: vale o que ele viu.
    const { dependencies, texts, createOrderCalls } = buildDependencies(1200)

    await new CheckoutHandler(dependencies).handle({
      session: buildSession({
        currentState: CONVERSATION_STATE.CONFIRMING,
        context: {
          checkoutDeliveryType: DELIVERY_TYPE.DELIVERY,
          checkoutDeliveryFeeInCents: CONFIGURED_FEE_IN_CENTS,
          checkoutPaymentMethod: PAYMENT_METHOD.PIX,
          checkoutReceiptPreference: RECEIPT_PREFERENCE.WHATSAPP,
        },
      }),
      customer: { id: 'customer-1' } as never,
      message: pressButton(CONFIRMING_BUTTON_ID.CONFIRM),
    })

    expect(createOrderCalls[0]?.quotedDeliveryFeeInCents).toBe(CONFIGURED_FEE_IN_CENTS)
    expect(texts[0]).toContain(MESSAGES.ORDER_CONFIRMED_TOTAL_LINE.replace('{total}', formatPriceInCents(14050)))
  })
})
