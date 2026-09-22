/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cobre o formato exato do resumo antes de confirmar (spec §3.4): itens, subtotal, taxa (ou
 * "grátis"/ausente na retirada), total cobrado, entrega/retirada, pagamento (com troco) e recibo.
 */

import { describe, expect, it } from 'bun:test'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { DELIVERY_LOCATION_SOURCE } from '@/modules/order/shared/DeliveryFeeQuote.constant'
import {
  DELIVERY_TYPE_BUTTON_ID,
  MESSAGES,
  PAYMENT_METHOD_BUTTON_ID,
  RECEIPT_PREFERENCE_BUTTON_ID,
} from '@/modules/conversation/shared/Messages.constant'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'
import { enterConfirming, type EnterConfirmingDependencies } from './enterConfirming'

const PHONE = '5511988887777'
const CUSTOMER_ID = 'customer-1'

function buildDependencies() {
  const texts: string[] = []
  const stateUpdates: { currentState: string; context: Record<string, unknown> }[] = []
  const buttonMessages: { body: string; buttons: readonly { id: string; title: string }[] }[] = []

  const dependencies = {
    cartRepository: {
      async findOpenByCustomer() {
        return { id: 'cart-1' }
      },
      async listItems() {
        return [{ productId: 'rice', quantity: 2 }]
      },
    },
    productRepository: {
      async findById() {
        return { name: 'Arroz 5kg', priceInCents: 2490 }
      },
    },
    conversationSessionRepository: {
      async updateStateByPhone(params: { currentState: string; context: Record<string, unknown> }) {
        stateUpdates.push({ currentState: params.currentState, context: params.context })
        return undefined
      },
    },
    whatsAppSender: {
      async sendText(_phone: string, text: string) {
        texts.push(text)
        return undefined
      },
      async sendInteractiveButtons(_phone: string, body: string, buttons: readonly { id: string; title: string }[]) {
        buttonMessages.push({ body, buttons })
      },
    },
  } as unknown as EnterConfirmingDependencies

  return { dependencies, buttonMessages, texts, stateUpdates }
}

describe('enterConfirming — resumo antes de confirmar', () => {
  it('entrega com taxa: mostra subtotal, taxa e total cobrado', async () => {
    const { dependencies, buttonMessages } = buildDependencies()

    await enterConfirming({
      dependencies,
      customerPhone: PHONE,
      customerId: CUSTOMER_ID,
      checkoutContext: {
        checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY,
        checkoutDeliveryFeeInCents: 800,
        checkoutDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.CEP,
        checkoutAddress: {
          street: 'Rua X',
          number: '123',
          neighborhood: 'Bairro',
          city: 'São Paulo',
          state: 'SP',
        },
        checkoutPaymentMethod: PAYMENT_METHOD_BUTTON_ID.PIX,
        checkoutReceiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP,
      },
    })

    const summary = buttonMessages[0]?.body ?? ''
    expect(summary).toContain(`Subtotal: ${formatPriceInCents(4980)}`)
    expect(summary).toContain(`Taxa de entrega: ${formatPriceInCents(800)}`)
    expect(summary).toContain(`Total: ${formatPriceInCents(5780)}`)
    expect(summary).toContain('Entrega: Rua X, 123 — Bairro, São Paulo/SP')
    expect(summary).toContain('Pagamento: 💳 Pix')
    expect(summary).toContain('Recibo: 📱 WhatsApp')
  })

  it('sessão anterior ao deploy (entrega sem cotação por faixa): não mostra resumo, volta ao endereço', async () => {
    const { dependencies, buttonMessages, texts, stateUpdates } = buildDependencies()

    await enterConfirming({
      dependencies,
      customerPhone: PHONE,
      customerId: CUSTOMER_ID,
      checkoutContext: {
        checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY,
        checkoutDeliveryFeeInCents: 0,
        checkoutAddress: 'Rua X, 123',
        checkoutPaymentMethod: PAYMENT_METHOD_BUTTON_ID.CASH,
        checkoutCashChangeForInCents: 10000,
        checkoutReceiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP,
      },
    })

    expect(buttonMessages).toEqual([])
    expect(texts).toEqual([MESSAGES.CHECKOUT_DELIVERY_QUOTE_MISSING])
    expect(stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.AWAITING_ADDRESS)
    expect(stateUpdates[0]?.context).toEqual({
      checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY,
      checkoutPaymentMethod: PAYMENT_METHOD_BUTTON_ID.CASH,
      checkoutReceiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP,
    })
  })

  it('entrega grátis: mostra "grátis" em vez de R$ 0,00', async () => {
    const { dependencies, buttonMessages } = buildDependencies()

    await enterConfirming({
      dependencies,
      customerPhone: PHONE,
      customerId: CUSTOMER_ID,
      checkoutContext: {
        checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY,
        checkoutDeliveryFeeInCents: 0,
        checkoutDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.CEP,
        checkoutAddress: {
          street: 'Rua X',
          number: '123',
          neighborhood: 'Bairro',
          city: 'São Paulo',
          state: 'SP',
        },
        checkoutPaymentMethod: PAYMENT_METHOD_BUTTON_ID.PIX,
        checkoutReceiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP,
      },
    })

    const summary = buttonMessages[0]?.body ?? ''
    expect(summary).toContain('Taxa de entrega: grátis')
    expect(summary).toContain(`Total: ${formatPriceInCents(4980)}`)
  })

  it('retirada: não mostra a linha de taxa', async () => {
    const { dependencies, buttonMessages } = buildDependencies()

    await enterConfirming({
      dependencies,
      customerPhone: PHONE,
      customerId: CUSTOMER_ID,
      checkoutContext: {
        checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.PICKUP,
        checkoutDeliveryFeeInCents: 0,
        checkoutDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.CEP,
        checkoutPaymentMethod: PAYMENT_METHOD_BUTTON_ID.PIX,
        checkoutReceiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP,
      },
    })

    const summary = buttonMessages[0]?.body ?? ''
    expect(summary).not.toContain('Taxa de entrega')
    expect(summary).toContain(`Total: ${formatPriceInCents(4980)}`)
    expect(summary).toContain('Entrega: Retirada na loja')
  })

  it('entrega cotada com faixa e distância: mostra "Taxa de entrega (até N km · X km): R$ Y" (T3.2, spec §3.4)', async () => {
    const { dependencies, buttonMessages } = buildDependencies()

    await enterConfirming({
      dependencies,
      customerPhone: PHONE,
      customerId: CUSTOMER_ID,
      checkoutContext: {
        checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY,
        checkoutDeliveryFeeInCents: 1000,
        checkoutDeliveryDistanceKm: 6.4,
        checkoutDeliveryTierMaxKm: 8,
        checkoutDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.CEP,
        checkoutAddress: {
          street: 'Rua X',
          number: '123',
          neighborhood: 'Bairro',
          city: 'São Paulo',
          state: 'SP',
        },
        checkoutPaymentMethod: PAYMENT_METHOD_BUTTON_ID.PIX,
        checkoutReceiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP,
      },
    })

    const summary = buttonMessages[0]?.body ?? ''
    expect(summary).toContain(`Taxa de entrega (até 8 km · 6,4 km): ${formatPriceInCents(1000)}`)
  })

  it('entrega aproximada pela cidade (D3): mostra "Taxa de entrega (estimativa pela cidade, até N km): R$ Y", sem distância', async () => {
    const { dependencies, buttonMessages } = buildDependencies()

    await enterConfirming({
      dependencies,
      customerPhone: PHONE,
      customerId: CUSTOMER_ID,
      checkoutContext: {
        checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY,
        checkoutDeliveryFeeInCents: 1000,
        checkoutDeliveryTierMaxKm: 8,
        checkoutDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.CEP_APPROXIMATE,
        checkoutAddress: {
          street: 'Rua X',
          number: '123',
          neighborhood: 'Bairro',
          city: 'São Paulo',
          state: 'SP',
        },
        checkoutPaymentMethod: PAYMENT_METHOD_BUTTON_ID.PIX,
        checkoutReceiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP,
      },
    })

    const summary = buttonMessages[0]?.body ?? ''
    expect(summary).toContain(`Taxa de entrega (estimativa pela cidade, até 8 km): ${formatPriceInCents(1000)}`)
    expect(summary).not.toMatch(/· \d/)
  })

  it('retirada com faixa no contexto (não deveria ter, mas por segurança): continua sem linha de taxa nem faixa', async () => {
    const { dependencies, buttonMessages } = buildDependencies()

    await enterConfirming({
      dependencies,
      customerPhone: PHONE,
      customerId: CUSTOMER_ID,
      checkoutContext: {
        checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.PICKUP,
        checkoutDeliveryFeeInCents: 0,
        checkoutDeliveryTierMaxKm: 8,
        checkoutDeliveryDistanceKm: 3,
        checkoutDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.CEP,
        checkoutPaymentMethod: PAYMENT_METHOD_BUTTON_ID.PIX,
        checkoutReceiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP,
      },
    })

    const summary = buttonMessages[0]?.body ?? ''
    expect(summary).not.toContain('Taxa de entrega')
    expect(summary).not.toContain('km')
  })

  it('dinheiro com troco: mostra a linha de pagamento com o valor do troco', async () => {
    const { dependencies, buttonMessages } = buildDependencies()

    await enterConfirming({
      dependencies,
      customerPhone: PHONE,
      customerId: CUSTOMER_ID,
      checkoutContext: {
        checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY,
        checkoutDeliveryFeeInCents: 800,
        checkoutDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.CEP,
        checkoutAddress: {
          street: 'Rua X',
          number: '123',
          neighborhood: 'Bairro',
          city: 'São Paulo',
          state: 'SP',
        },
        checkoutPaymentMethod: PAYMENT_METHOD_BUTTON_ID.CASH,
        checkoutCashChangeForInCents: 15000,
        checkoutReceiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP,
      },
    })

    const summary = buttonMessages[0]?.body ?? ''
    expect(summary).toContain(`Pagamento: 💵 Dinheiro — troco para ${formatPriceInCents(15000)}`)
  })
})
