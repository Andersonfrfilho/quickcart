/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Taxa de entrega no WhatsApp (T3.1, spec §3.4): cotada pela faixa quando o ENDEREÇO fica pronto — o
 * clique em "Entrega" não cota — e gravada no contexto. O pedido usa essa cotação, sem recotar: o troco
 * já foi validado contra ela.
 */

import { describe, expect, it } from 'bun:test'

import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { CONFIRMING_BUTTON_ID, DELIVERY_TYPE_BUTTON_ID, MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { DELIVERY_TYPE, PAYMENT_METHOD, RECEIPT_PREFERENCE } from '@/modules/order/shared/Order.constant'
import { CheckoutHandler, type CheckoutHandlerDependencies } from './CheckoutHandler'

const PHONE = '5511988887777'
const QUOTED_FEE_IN_CENTS = 800

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
  let quoteCalls = 0
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
    quoteDeliveryFeeUseCase: {
      async execute() {
        quoteCalls += 1
        throw new Error('o clique em Entrega/Retirada e a confirmação não cotam')
      },
    },
  } as unknown as CheckoutHandlerDependencies

  return { dependencies, texts, stateUpdates, createOrderCalls, getQuoteCalls: () => quoteCalls }
}

function pressButton(buttonId: string) {
  return { kind: 'button_reply', from: PHONE, waMessageId: 'wa-1', buttonId, buttonTitle: '' } as const
}

describe('CheckoutHandler — taxa de entrega cotada no contexto', () => {
  it('clique em Entrega não cota: pede o endereço, sem taxa no contexto', async () => {
    const { dependencies, stateUpdates, texts, getQuoteCalls } = buildDependencies()

    await new CheckoutHandler(dependencies).handle({
      session: buildSession(),
      customer: { id: 'customer-1' } as never,
      message: pressButton(DELIVERY_TYPE_BUTTON_ID.DELIVERY),
    })

    expect(stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.AWAITING_ADDRESS)
    expect(stateUpdates[0]?.context).toEqual({ checkoutDeliveryType: DELIVERY_TYPE.DELIVERY })
    expect(texts).toEqual([MESSAGES.CHECKOUT_ASK_ADDRESS])
    expect(getQuoteCalls()).toBe(0)
  })

  it('retirada grava taxa 0 direto, sem cotar', async () => {
    const { dependencies, stateUpdates, getQuoteCalls } = buildDependencies()

    await new CheckoutHandler(dependencies).handle({
      session: buildSession(),
      customer: { id: 'customer-1' } as never,
      message: pressButton(DELIVERY_TYPE_BUTTON_ID.PICKUP),
    })

    expect(stateUpdates[0]?.context.checkoutDeliveryFeeInCents).toBe(0)
    expect(stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.AWAITING_PAYMENT)
    expect(getQuoteCalls()).toBe(0)
  })

  it('confirmar passa a cotação do contexto ao pedido, sem recotar, e mostra itens + taxa como total', async () => {
    const { dependencies, texts, createOrderCalls, getQuoteCalls } = buildDependencies()

    await new CheckoutHandler(dependencies).handle({
      session: buildSession({
        currentState: CONVERSATION_STATE.CONFIRMING,
        context: {
          checkoutDeliveryType: DELIVERY_TYPE.DELIVERY,
          checkoutDeliveryFeeInCents: QUOTED_FEE_IN_CENTS,
          checkoutDeliveryDistanceKm: 2.4,
          checkoutDeliveryTierMaxKm: 3,
          checkoutDeliveryTierFeeInCents: QUOTED_FEE_IN_CENTS,
          checkoutDeliveryLocationSource: 'cep',
          checkoutPaymentMethod: PAYMENT_METHOD.PIX,
          checkoutReceiptPreference: RECEIPT_PREFERENCE.WHATSAPP,
        },
      }),
      customer: { id: 'customer-1' } as never,
      message: pressButton(CONFIRMING_BUTTON_ID.CONFIRM),
    })

    expect(createOrderCalls[0]).toMatchObject({
      quotedDeliveryFeeInCents: QUOTED_FEE_IN_CENTS,
      quotedDeliveryDistanceKm: 2.4,
      quotedDeliveryTierMaxKm: 3,
      quotedDeliveryTierFeeInCents: QUOTED_FEE_IN_CENTS,
      quotedDeliveryLocationSource: 'cep',
    })
    expect(getQuoteCalls()).toBe(0)
    expect(texts[0]).toContain(MESSAGES.ORDER_CONFIRMED_TOTAL_LINE.replace('{total}', formatPriceInCents(14050)))
  })
})
