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
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'
import type { Customer } from '@/infra/database/schema'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { CASH_CHANGE_BUTTON_ID, MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { CashChangeHandler, type CashChangeHandlerDependencies } from './CashChangeHandler'

const PHONE = '5511988887777'
const CUSTOMER_ID = 'customer-1'
const CART_ID = 'cart-1'

function buildSession(overrides: Partial<ConversationSession> = {}): ConversationSession {
  return {
    id: 'session-1',
    customerPhone: PHONE,
    currentState: CONVERSATION_STATE.AWAITING_CASH_CHANGE,
    context: {},
    mode: 'bot',
    lastInteractionAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function buildCustomer(): Customer {
  return { id: CUSTOMER_ID } as unknown as Customer
}

const QUOTED_DELIVERY_CONTEXT = {
  checkoutDeliveryType: 'delivery',
  checkoutDeliveryFeeInCents: 800,
  checkoutDeliveryLocationSource: 'cep',
}

function buildDependencies() {
  const texts: string[] = []
  const buttonMessages: { body: string; buttons: readonly { id: string; title: string }[] }[] = []
  const stateUpdates: { currentState: string; context: Record<string, unknown> }[] = []

  const dependencies: CashChangeHandlerDependencies = {
    conversationSessionRepository: {
      async updateStateByPhone(params) {
        stateUpdates.push({ currentState: params.currentState, context: params.context })
        return undefined
      },
    },
    whatsAppSender: {
      async sendText(_phone: string, text: string) {
        texts.push(text)
      },
      async sendInteractiveButtons(_phone: string, body: string, buttons) {
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
  }

  return { dependencies, texts, buttonMessages, stateUpdates }
}

describe('CashChangeHandler', () => {
  it('"Não preciso" grava null e segue para o recibo', async () => {
    const { dependencies, stateUpdates, buttonMessages } = buildDependencies()
    const handler = new CashChangeHandler(dependencies)

    await handler.handle({
      session: buildSession(),
      customer: buildCustomer(),
      message: { kind: 'button_reply', from: PHONE, waMessageId: 'wa-1', buttonId: CASH_CHANGE_BUTTON_ID.NOT_NEEDED, buttonTitle: '🙅 Não preciso' },
    })

    expect(stateUpdates).toEqual([
      { currentState: CONVERSATION_STATE.AWAITING_RECEIPT_PREFERENCE, context: { checkoutCashChangeForInCents: null } },
    ])
    expect(buttonMessages).toHaveLength(1)
    expect(buttonMessages[0]?.body).toBe(MESSAGES.CHECKOUT_ASK_RECEIPT_PREFERENCE)
  })

  it('"Preciso de troco" pede o valor', async () => {
    const { dependencies, stateUpdates, texts } = buildDependencies()
    const handler = new CashChangeHandler(dependencies)

    await handler.handle({
      session: buildSession(),
      customer: buildCustomer(),
      message: { kind: 'button_reply', from: PHONE, waMessageId: 'wa-1', buttonId: CASH_CHANGE_BUTTON_ID.NEEDED, buttonTitle: '💵 Preciso de troco' },
    })

    expect(stateUpdates).toEqual([{ currentState: CONVERSATION_STATE.AWAITING_CASH_CHANGE_AMOUNT, context: {} }])
    expect(texts).toEqual([MESSAGES.CHECKOUT_ASK_CASH_CHANGE_AMOUNT])
  })

  it('recusa valor que não cobre a compra (total do carrinho é R$ 100,00) e repete a pergunta', async () => {
    const { dependencies, texts, stateUpdates } = buildDependencies()
    const handler = new CashChangeHandler(dependencies)

    await handler.handle({
      session: buildSession({ currentState: CONVERSATION_STATE.AWAITING_CASH_CHANGE_AMOUNT }),
      customer: buildCustomer(),
      message: { kind: 'text', from: PHONE, waMessageId: 'wa-2', body: '90' },
    })

    expect(texts).toEqual([MESSAGES.CHECKOUT_CASH_CHANGE_TOO_LOW.replace('{total}', 'R$ 100,00')])
    expect(stateUpdates).toEqual([])
  })

  it('valor EXATO do total ("vou pagar com 100") vale como "não preciso de troco": grava null e segue', async () => {
    const { dependencies, texts, stateUpdates } = buildDependencies()
    const handler = new CashChangeHandler(dependencies)

    await handler.handle({
      session: buildSession({ currentState: CONVERSATION_STATE.AWAITING_CASH_CHANGE_AMOUNT }),
      customer: buildCustomer(),
      message: { kind: 'text', from: PHONE, waMessageId: 'wa-2', body: 'vou pagar com 100' },
    })

    expect(texts).toEqual([])
    expect(stateUpdates).toEqual([
      { currentState: CONVERSATION_STATE.AWAITING_RECEIPT_PREFERENCE, context: { checkoutCashChangeForInCents: null } },
    ])
  })

  it('em AWAITING_CASH_CHANGE, valor digitado ("troco pra 150") vale como "Preciso de troco" + valor', async () => {
    const { dependencies, stateUpdates, buttonMessages } = buildDependencies()
    const handler = new CashChangeHandler(dependencies)

    await handler.handle({
      session: buildSession(),
      customer: buildCustomer(),
      message: { kind: 'text', from: PHONE, waMessageId: 'wa-3', body: 'troco pra 150' },
    })

    expect(stateUpdates).toEqual([
      { currentState: CONVERSATION_STATE.AWAITING_RECEIPT_PREFERENCE, context: { checkoutCashChangeForInCents: 15000 } },
    ])
    expect(buttonMessages[0]?.body).toBe(MESSAGES.CHECKOUT_ASK_RECEIPT_PREFERENCE)
  })

  it('em AWAITING_CASH_CHANGE, valor digitado passa pela mesma validação (não cobre → recusa)', async () => {
    const { dependencies, texts, stateUpdates } = buildDependencies()
    const handler = new CashChangeHandler(dependencies)

    await handler.handle({
      session: buildSession(),
      customer: buildCustomer(),
      message: { kind: 'text', from: PHONE, waMessageId: 'wa-3', body: 'troco pra 80' },
    })

    expect(texts).toEqual([MESSAGES.CHECKOUT_CASH_CHANGE_TOO_LOW.replace('{total}', formatPriceInCents(10000))])
    expect(stateUpdates).toEqual([])
  })

  it('valor válido (acima do total) grava o troco e segue para o recibo', async () => {
    const { dependencies, stateUpdates, buttonMessages } = buildDependencies()
    const handler = new CashChangeHandler(dependencies)

    await handler.handle({
      session: buildSession({ currentState: CONVERSATION_STATE.AWAITING_CASH_CHANGE_AMOUNT }),
      customer: buildCustomer(),
      message: { kind: 'text', from: PHONE, waMessageId: 'wa-2', body: '150' },
    })

    expect(stateUpdates).toEqual([
      { currentState: CONVERSATION_STATE.AWAITING_RECEIPT_PREFERENCE, context: { checkoutCashChangeForInCents: 15000 } },
    ])
    expect(buttonMessages).toHaveLength(1)
  })

  it('texto inválido não grava nada e pede o valor de novo', async () => {
    const { dependencies, texts, stateUpdates } = buildDependencies()
    const handler = new CashChangeHandler(dependencies)

    await handler.handle({
      session: buildSession({ currentState: CONVERSATION_STATE.AWAITING_CASH_CHANGE_AMOUNT }),
      customer: buildCustomer(),
      message: { kind: 'text', from: PHONE, waMessageId: 'wa-2', body: 'abc' },
    })

    expect(texts).toEqual([MESSAGES.CHECKOUT_CASH_CHANGE_INVALID])
    expect(stateUpdates).toEqual([])
  })

  describe('taxa de entrega (T2.1): troco validado contra itens + taxa cotada no contexto', () => {
    it('recusa valor que cobre os itens (R$ 100,00) mas não itens + taxa (R$ 108,00)', async () => {
      const { dependencies, texts, stateUpdates } = buildDependencies()
      const handler = new CashChangeHandler(dependencies)

      await handler.handle({
        session: buildSession({
          currentState: CONVERSATION_STATE.AWAITING_CASH_CHANGE_AMOUNT,
          context: QUOTED_DELIVERY_CONTEXT,
        }),
        customer: buildCustomer(),
        message: { kind: 'text', from: PHONE, waMessageId: 'wa-2', body: '105' },
      })

      expect(texts).toEqual([MESSAGES.CHECKOUT_CASH_CHANGE_TOO_LOW.replace('{total}', formatPriceInCents(10800))])
      expect(stateUpdates).toEqual([])
    })

    it('sessão anterior ao deploy (entrega sem cotação por faixa): não valida troco sem taxa, volta ao endereço', async () => {
      const { dependencies, texts, stateUpdates } = buildDependencies()
      const handler = new CashChangeHandler(dependencies)

      await handler.handle({
        session: buildSession({
          currentState: CONVERSATION_STATE.AWAITING_CASH_CHANGE_AMOUNT,
          context: { checkoutDeliveryType: 'delivery', checkoutDeliveryFeeInCents: 0, checkoutPaymentMethod: 'cash' },
        }),
        customer: buildCustomer(),
        message: { kind: 'text', from: PHONE, waMessageId: 'wa-2', body: '105' },
      })

      expect(texts).toEqual([MESSAGES.CHECKOUT_DELIVERY_QUOTE_MISSING])
      expect(stateUpdates).toEqual([
        { currentState: CONVERSATION_STATE.AWAITING_ADDRESS, context: { checkoutDeliveryType: 'delivery', checkoutPaymentMethod: 'cash' } },
      ])
    })

    it('aceita valor acima de itens + taxa', async () => {
      const { dependencies, stateUpdates } = buildDependencies()
      const handler = new CashChangeHandler(dependencies)

      await handler.handle({
        session: buildSession({
          currentState: CONVERSATION_STATE.AWAITING_CASH_CHANGE_AMOUNT,
          context: QUOTED_DELIVERY_CONTEXT,
        }),
        customer: buildCustomer(),
        message: { kind: 'text', from: PHONE, waMessageId: 'wa-2', body: '110' },
      })

      expect(stateUpdates[0]?.context).toEqual({ ...QUOTED_DELIVERY_CONTEXT, checkoutCashChangeForInCents: 11000 })
    })
  })

  describe('checkout lembrado (correção T1.1/T1.2): recibo já veio no contexto', () => {
    it('"Não preciso" com recibo já lembrado vai direto à confirmação, sem perguntar recibo', async () => {
      const { dependencies, stateUpdates, buttonMessages } = buildDependencies()
      const handler = new CashChangeHandler(dependencies)

      await handler.handle({
        session: buildSession({ context: { checkoutReceiptPreference: 'whatsapp' } }),
        customer: buildCustomer(),
        message: { kind: 'button_reply', from: PHONE, waMessageId: 'wa-1', buttonId: CASH_CHANGE_BUTTON_ID.NOT_NEEDED, buttonTitle: '🙅 Não preciso' },
      })

      expect(stateUpdates).toEqual([{ currentState: CONVERSATION_STATE.CONFIRMING, context: expect.any(Object) }])
      expect(buttonMessages).toHaveLength(1)
      expect(buttonMessages[0]?.body).not.toBe(MESSAGES.CHECKOUT_ASK_RECEIPT_PREFERENCE)
    })

    it('valor válido com recibo já lembrado vai direto à confirmação, sem perguntar recibo', async () => {
      const { dependencies, stateUpdates, buttonMessages } = buildDependencies()
      const handler = new CashChangeHandler(dependencies)

      await handler.handle({
        session: buildSession({
          currentState: CONVERSATION_STATE.AWAITING_CASH_CHANGE_AMOUNT,
          context: { checkoutReceiptPreference: 'whatsapp' },
        }),
        customer: buildCustomer(),
        message: { kind: 'text', from: PHONE, waMessageId: 'wa-2', body: '150' },
      })

      expect(stateUpdates).toEqual([{ currentState: CONVERSATION_STATE.CONFIRMING, context: expect.any(Object) }])
      expect(buttonMessages).toHaveLength(1)
      expect(buttonMessages[0]?.body).not.toBe(MESSAGES.CHECKOUT_ASK_RECEIPT_PREFERENCE)
    })
  })
})
