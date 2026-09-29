/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O desvio de falta de estoque: o que o cliente lê e o que ele pode tocar.
 *
 * O erro sempre soube quais itens faltaram e quanto sobrou de cada um; nada disso chegava à
 * conversa. Sobre um resumo de carrinho sem nenhuma marca, a única saída à mão era tentar fechar de
 * novo — e falhar igual.
 */

import { describe, expect, it } from 'bun:test'
import type { Customer } from '@/infra/database/schema'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import {
  CART_REVIEW_BUTTON_ID,
  CONFIRMING_BUTTON_ID,
  GLOBAL_BUTTON_ID,
  MESSAGES,
  OUT_OF_STOCK_REVIEW_BUTTONS,
} from '@/modules/conversation/shared/Messages.constant'
import { DELIVERY_TYPE, PAYMENT_METHOD, RECEIPT_PREFERENCE } from '@/modules/order/shared/Order.constant'
import { OrderInsufficientStockError } from '@/shared/errors/OrderErrors'
import { CheckoutHandler, type CheckoutHandlerDependencies } from './CheckoutHandler'

const PHONE = '5511988887777'
const CUSTOMER: Pick<Customer, 'id'> = { id: 'customer-1' }

const PRODUCTS: Record<string, { name: string; priceInCents: number }> = {
  'product-rice': { name: 'Arroz 5kg', priceInCents: 2590 },
  'product-beans': { name: 'Feijão 1kg', priceInCents: 890 },
}

function buildSession(): ConversationSession {
  return {
    id: 'session-1',
    customerPhone: PHONE,
    currentState: CONVERSATION_STATE.CONFIRMING,
    context: {
      checkoutDeliveryType: DELIVERY_TYPE.PICKUP,
      checkoutPaymentMethod: PAYMENT_METHOD.PIX,
      checkoutReceiptPreference: RECEIPT_PREFERENCE.WHATSAPP,
    },
    mode: 'bot',
    humanRequestedAt: null,
    lastInteractionAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function buildDependencies(missingItems: ReadonlyArray<{ productId: string; requested: number; available: number }>) {
  const texts: string[] = []
  const buttonMessages: { body: string; buttons: readonly { id: string; title: string }[] }[] = []

  const dependencies = {
    orderRealtimeNotifier: { notifyOrderChanged: () => undefined },
    conversationSessionRepository: {
      async updateStateByPhone() {
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
        return { id: 'cart-1', shortCode: 'C1D2E3' }
      },
      async listItems() {
        return [
          { productId: 'product-rice', quantity: 2 },
          { productId: 'product-beans', quantity: 1 },
        ]
      },
    },
    productRepository: {
      async findById(productId: string) {
        return PRODUCTS[productId]
      },
    },
    customerRepository: {},
    createOrderFromCartUseCase: {
      async execute() {
        throw new OrderInsufficientStockError(missingItems)
      },
    },
    addressLookupProvider: {},
  } as unknown as CheckoutHandlerDependencies

  return { dependencies, texts, buttonMessages }
}

async function confirmOrder(dependencies: CheckoutHandlerDependencies): Promise<void> {
  const handler = new CheckoutHandler(dependencies)
  await handler.handle({
    session: buildSession(),
    customer: CUSTOMER as Customer,
    message: {
      kind: 'button_reply',
      from: PHONE,
      waMessageId: 'wa-1',
      buttonId: CONFIRMING_BUTTON_ID.CONFIRM,
      buttonTitle: '✅ Confirmar',
    },
  })
}

describe('CheckoutHandler — falta de estoque ao fechar', () => {
  it('nomeia o que esgotou e o que sobrou em vez de dizer "alguns itens"', async () => {
    const { dependencies, texts } = buildDependencies([
      { productId: 'product-rice', requested: 2, available: 0 },
      { productId: 'product-beans', requested: 1, available: 1 },
    ])

    await confirmOrder(dependencies)

    expect(texts).toHaveLength(1)
    expect(texts[0]).toContain('Arroz 5kg — esgotado')
    expect(texts[0]).toContain('Feijão 1kg — você pediu 1, temos 1')
  })

  it('reabre o carrinho sem "Fechar pedido" e com a saída no lugar dele', async () => {
    const { dependencies, buttonMessages } = buildDependencies([
      { productId: 'product-rice', requested: 2, available: 0 },
    ])

    await confirmOrder(dependencies)

    expect(buttonMessages).toHaveLength(1)
    expect(buttonMessages[0]?.buttons).toBe(OUT_OF_STOCK_REVIEW_BUTTONS)

    const buttonIds = buttonMessages[0]?.buttons.map((button) => button.id)
    expect(buttonIds).not.toContain(CART_REVIEW_BUTTON_ID.CHECKOUT)
    expect(buttonIds).toContain(GLOBAL_BUTTON_ID.EXIT)
  })

  it('cai no id do produto quando o catálogo não devolve o item', async () => {
    const { dependencies, texts } = buildDependencies([
      { productId: 'product-unknown', requested: 3, available: 1 },
    ])

    await confirmOrder(dependencies)

    expect(texts[0]).toContain('product-unknown — você pediu 3, temos 1')
  })
})
