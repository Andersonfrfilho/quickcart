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
import {
  DELIVERY_TYPE_BUTTON_ID,
  PAYMENT_METHOD_BUTTON_ID,
  RECEIPT_PREFERENCE_BUTTON_ID,
} from '@/modules/conversation/shared/Messages.constant'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'
import { enterConfirming, type EnterConfirmingDependencies } from './enterConfirming'

const PHONE = '5511988887777'
const CUSTOMER_ID = 'customer-1'

function buildDependencies() {
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
      async updateStateByPhone() {
        return undefined
      },
    },
    whatsAppSender: {
      async sendText() {
        return undefined
      },
      async sendInteractiveButtons(_phone: string, body: string, buttons: readonly { id: string; title: string }[]) {
        buttonMessages.push({ body, buttons })
      },
    },
  } as unknown as EnterConfirmingDependencies

  return { dependencies, buttonMessages }
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

  it('entrega grátis: mostra "grátis" em vez de R$ 0,00', async () => {
    const { dependencies, buttonMessages } = buildDependencies()

    await enterConfirming({
      dependencies,
      customerPhone: PHONE,
      customerId: CUSTOMER_ID,
      checkoutContext: {
        checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY,
        checkoutDeliveryFeeInCents: 0,
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
        checkoutPaymentMethod: PAYMENT_METHOD_BUTTON_ID.PIX,
        checkoutReceiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP,
      },
    })

    const summary = buttonMessages[0]?.body ?? ''
    expect(summary).not.toContain('Taxa de entrega')
    expect(summary).toContain(`Total: ${formatPriceInCents(4980)}`)
    expect(summary).toContain('Entrega: Retirada na loja')
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
