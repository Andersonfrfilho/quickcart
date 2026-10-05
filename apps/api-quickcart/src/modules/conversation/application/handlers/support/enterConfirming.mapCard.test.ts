/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Qual link o resumo manda, e como.
 *
 * O card do mapa só existe se a mensagem for de texto E pedir `previewUrl`: a Meta não renderiza
 * preview em mensagem `interactive`, que é como o resumo com botões sai. Por isso o link viaja
 * sozinho, antes do resumo — e é isso que estes testes travam. O caso que NÃO manda (retirada na
 * loja) vale tanto quanto o que manda.
 */

import { describe, expect, it } from 'bun:test'
import {
  DELIVERY_TYPE_BUTTON_ID,
  MESSAGES,
  PAYMENT_METHOD_BUTTON_ID,
  RECEIPT_PREFERENCE_BUTTON_ID,
} from '@/modules/conversation/shared/Messages.constant'
import { DELIVERY_LOCATION_SOURCE } from '@/modules/order/shared/DeliveryFeeQuote.constant'
import { enterConfirming, type EnterConfirmingDependencies } from './enterConfirming'

const PHONE = '5511988887777'
const CUSTOMER_ID = 'customer-1'

const WHATSAPP_LOCATION = { latitude: -20.5386, longitude: -47.4008, number: '6531' }

const CEP_ADDRESS = {
  cep: '14412314',
  street: 'Rua Radialista Alfeu Stabelini',
  number: '6531',
  neighborhood: 'Franca Pólo Club',
  city: 'Franca',
  state: 'SP',
}

type SentText = { body: string; previewUrl: boolean | undefined }

function buildHarness() {
  const texts: SentText[] = []
  const buttonMessages: { body: string }[] = []

  const dependencies = {
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
        return { name: 'Arroz 5kg', priceInCents: 2490 }
      },
    },
    conversationSessionRepository: {
      async updateStateByPhone() {
        return undefined
      },
    },
    whatsAppSender: {
      async sendText(_phone: string, body: string, options?: { previewUrl?: boolean }) {
        texts.push({ body, previewUrl: options?.previewUrl })
        return undefined
      },
      async sendInteractiveButtons(_phone: string, body: string) {
        buttonMessages.push({ body })
      },
    },
  } as unknown as EnterConfirmingDependencies

  return { dependencies, texts, buttonMessages }
}

function buildContext(overrides: Record<string, unknown>) {
  return {
    checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY,
    checkoutDeliveryFeeInCents: 1000,
    checkoutDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.CEP,
    checkoutPaymentMethod: PAYMENT_METHOD_BUTTON_ID.CASH,
    checkoutReceiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP,
    ...overrides,
  }
}

describe('enterConfirming — card do mapa', () => {
  it('pede o card ao mandar o link do endereço digitado', async () => {
    const harness = buildHarness()

    await enterConfirming({
      dependencies: harness.dependencies,
      customerPhone: PHONE,
      customerId: CUSTOMER_ID,
      checkoutContext: buildContext({ checkoutAddress: CEP_ADDRESS }),
    })

    expect(harness.texts).toHaveLength(1)
    expect(harness.texts[0]?.previewUrl).toBe(true)
    expect(harness.texts[0]?.body).toContain('google.com/maps')
  })

  it('usa a coordenada quando o cliente mandou a localização pelo WhatsApp', async () => {
    const harness = buildHarness()

    await enterConfirming({
      dependencies: harness.dependencies,
      customerPhone: PHONE,
      customerId: CUSTOMER_ID,
      checkoutContext: buildContext({
        checkoutAddress: WHATSAPP_LOCATION,
        checkoutDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.WHATSAPP_LOCATION,
      }),
    })

    expect(harness.texts).toHaveLength(1)
    expect(harness.texts[0]?.body).toContain(`${WHATSAPP_LOCATION.latitude},${WHATSAPP_LOCATION.longitude}`)
  })

  /** O card precisa chegar antes: depois do resumo ele vira rodapé de uma decisão já tomada. */
  it('o card vem ANTES do resumo com os botões', async () => {
    const harness = buildHarness()
    const order: string[] = []

    const dependencies = {
      ...harness.dependencies,
      whatsAppSender: {
        async sendText(_phone: string, body: string, options?: { previewUrl?: boolean }) {
          order.push('text')
          harness.texts.push({ body, previewUrl: options?.previewUrl })
        },
        async sendInteractiveButtons() {
          order.push('buttons')
        },
      },
    } as unknown as EnterConfirmingDependencies

    await enterConfirming({
      dependencies,
      customerPhone: PHONE,
      customerId: CUSTOMER_ID,
      checkoutContext: buildContext({ checkoutAddress: CEP_ADDRESS }),
    })

    expect(order).toEqual(['text', 'buttons'])
  })

  /** Quem vai à loja já sabe onde ela fica: mandar mapa ali é só uma bolha a mais. */
  it('retirada na loja não ganha card nenhum', async () => {
    const harness = buildHarness()

    await enterConfirming({
      dependencies: harness.dependencies,
      customerPhone: PHONE,
      customerId: CUSTOMER_ID,
      checkoutContext: buildContext({
        checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.PICKUP,
        checkoutDeliveryFeeInCents: 0,
        checkoutAddress: CEP_ADDRESS,
      }),
    })

    expect(harness.texts).toEqual([])
    expect(harness.buttonMessages).toHaveLength(1)
  })

  /** O link duplicado dentro do resumo deixaria a URL crua ao lado do card. */
  it('o resumo não repete o link do mapa', async () => {
    const harness = buildHarness()

    await enterConfirming({
      dependencies: harness.dependencies,
      customerPhone: PHONE,
      customerId: CUSTOMER_ID,
      checkoutContext: buildContext({ checkoutAddress: CEP_ADDRESS }),
    })

    expect(harness.buttonMessages[0]?.body).not.toContain('google.com/maps')
    expect(harness.buttonMessages[0]?.body).toContain(MESSAGES.CONFIRMING_ASK)
  })
})
