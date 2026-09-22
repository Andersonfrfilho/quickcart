/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * "Confirmar" com troco (T4.2): o troco é revalidado contra o total ATUAL antes de criar o pedido
 * (um preço pode mudar enquanto o cliente está em CONFIRMING), chega ao pedido e aparece na
 * mensagem de confirmação; sessão sem a taxa cotada no contexto cota a configurada, não 0.
 */

import { describe, expect, it } from 'bun:test'

import type { Customer } from '@/infra/database/schema'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { CONFIRMING_BUTTON_ID, MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { DELIVERY_TYPE, PAYMENT_METHOD, RECEIPT_PREFERENCE } from '@/modules/order/shared/Order.constant'
import { CheckoutHandler, type CheckoutHandlerDependencies } from './CheckoutHandler'

const PHONE = '5511988887777'
const CUSTOMER = { id: 'customer-1' } as Customer

type Scenario = {
  readonly unitPriceInCents: number
  readonly configuredDeliveryFeeInCents?: number
}

function buildSession(context: ConversationContext): ConversationSession {
  return {
    id: 'session-1',
    customerPhone: PHONE,
    currentState: CONVERSATION_STATE.CONFIRMING,
    context,
    mode: 'bot',
    lastInteractionAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function buildDependencies(scenario: Scenario) {
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
      async listItems() {
        return [{ productId: 'rice', quantity: 1 }]
      },
    },
    productRepository: {
      async findById() {
        return { name: 'Arroz 5kg', priceInCents: scenario.unitPriceInCents }
      },
    },
    customerRepository: {},
    createOrderFromCartUseCase: {
      async execute(params: Record<string, unknown>) {
        createOrderCalls.push(params)
        return {
          order: {
            id: 'order-1',
            shortCode: 'QC-1',
            deliveryType: DELIVERY_TYPE.PICKUP,
            totalInCents: scenario.unitPriceInCents,
            deliveryFeeInCents: params.quotedDeliveryFeeInCents,
            cashChangeForInCents: params.cashChangeForInCents ?? null,
          },
        }
      },
    },
    resolveOrderDeliveryEstimateUseCase: {},
    addressLookupProvider: {},
    storePreparationMinutes: 20,
    configuredDeliveryFeeInCents: scenario.configuredDeliveryFeeInCents ?? 0,
  } as unknown as CheckoutHandlerDependencies

  return { dependencies, texts, stateUpdates, createOrderCalls }
}

const CONFIRM = { kind: 'button_reply', from: PHONE, waMessageId: 'wa-1', buttonId: CONFIRMING_BUTTON_ID.CONFIRM, buttonTitle: '' } as const

function cashContext(cashChangeForInCents: number): ConversationContext {
  return {
    checkoutDeliveryType: DELIVERY_TYPE.PICKUP,
    checkoutDeliveryFeeInCents: 0,
    checkoutPaymentMethod: PAYMENT_METHOD.CASH,
    checkoutReceiptPreference: RECEIPT_PREFERENCE.WHATSAPP,
    checkoutCashChangeForInCents: cashChangeForInCents,
  }
}

describe('CheckoutHandler.confirmOrder — troco', () => {
  it('troco 50 aceito com total 48; preço subiu e o total foi a 52: NÃO cria o pedido e pergunta o troco de novo', async () => {
    const { dependencies, texts, stateUpdates, createOrderCalls } = buildDependencies({ unitPriceInCents: 5200 })
    const context = cashContext(5000)

    await new CheckoutHandler(dependencies).handle({ session: buildSession(context), customer: CUSTOMER, message: CONFIRM })

    expect(createOrderCalls).toHaveLength(0)
    expect(stateUpdates).toEqual([{ currentState: CONVERSATION_STATE.AWAITING_CASH_CHANGE_AMOUNT, context }])
    expect(texts).toEqual([MESSAGES.CHECKOUT_CASH_CHANGE_TOTAL_CHANGED.replace('{total}', formatPriceInCents(5200))])
  })

  it('total que ainda cabe no troco segue criando o pedido', async () => {
    const { dependencies, createOrderCalls } = buildDependencies({ unitPriceInCents: 4800 })

    await new CheckoutHandler(dependencies).handle({ session: buildSession(cashContext(5000)), customer: CUSTOMER, message: CONFIRM })

    expect(createOrderCalls).toHaveLength(1)
  })

  it('troco 150 no contexto chega ao pedido e aparece na mensagem de confirmação', async () => {
    const { dependencies, texts, createOrderCalls } = buildDependencies({ unitPriceInCents: 13250 })

    await new CheckoutHandler(dependencies).handle({ session: buildSession(cashContext(15000)), customer: CUSTOMER, message: CONFIRM })

    expect(createOrderCalls[0]?.cashChangeForInCents).toBe(15000)
    expect(texts[0]).toContain(MESSAGES.ORDER_CONFIRMED_CASH_CHANGE_LINE.replace('{valor}', formatPriceInCents(15000)))
  })

  it('sessão anterior ao deploy (sem checkoutDeliveryFeeInCents) com entrega: cobra a taxa configurada, não 0', async () => {
    const { dependencies, createOrderCalls } = buildDependencies({ unitPriceInCents: 4800, configuredDeliveryFeeInCents: 800 })

    await new CheckoutHandler(dependencies).handle({
      session: buildSession({
        checkoutDeliveryType: DELIVERY_TYPE.DELIVERY,
        checkoutPaymentMethod: PAYMENT_METHOD.PIX,
        checkoutReceiptPreference: RECEIPT_PREFERENCE.WHATSAPP,
      }),
      customer: CUSTOMER,
      message: CONFIRM,
    })

    expect(createOrderCalls[0]?.quotedDeliveryFeeInCents).toBe(800)
  })
})
