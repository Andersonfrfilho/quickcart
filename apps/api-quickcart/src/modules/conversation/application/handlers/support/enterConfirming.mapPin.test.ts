/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Qual pino o resumo manda, e com que rótulo.
 *
 * Coordenada de CEP é de rua, não de casa: ela só pode virar pino dizendo isso no rótulo, porque um
 * pino mudo ali PARECE endereço conferido — e conferir é a única função desta tela. O teste do caso
 * que NÃO manda vale tanto quanto o do que manda.
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

function buildHarness() {
  const locations: { latitude: number; longitude: number; name?: string; address?: string }[] = []
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
      async sendText() {
        return undefined
      },
      async sendInteractiveButtons(_phone: string, body: string) {
        buttonMessages.push({ body })
      },
      async sendLocation(params: { latitude: number; longitude: number; name?: string; address?: string }) {
        locations.push(params)
        return undefined
      },
    },
  } as unknown as EnterConfirmingDependencies

  return { dependencies, locations, buttonMessages }
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

describe('enterConfirming — pino do mapa', () => {
  it('manda o mapa quando o cliente enviou a localização pelo WhatsApp', async () => {
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

    expect(harness.locations).toHaveLength(1)
    expect(harness.locations[0]?.latitude).toBe(WHATSAPP_LOCATION.latitude)
    expect(harness.locations[0]?.longitude).toBe(WHATSAPP_LOCATION.longitude)
    expect(harness.locations[0]?.name).toBe(MESSAGES.CONFIRMING_SUMMARY_MAP_PIN_NAME)
  })

  it('o mapa vem ANTES do resumo, que termina na pergunta de confirmar', async () => {
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

    expect(harness.locations).toHaveLength(1)
    expect(harness.buttonMessages).toHaveLength(1)
  })

  it('sem resolvedor de coordenada, endereço de CEP segue só com o link', async () => {
    const harness = buildHarness()

    await enterConfirming({
      dependencies: harness.dependencies,
      customerPhone: PHONE,
      customerId: CUSTOMER_ID,
      checkoutContext: buildContext({ checkoutAddress: CEP_ADDRESS }),
    })

    expect(harness.locations).toEqual([])
    expect(harness.buttonMessages).toHaveLength(1)
  })

  it('endereço de CEP vira pino aproximado, e o rótulo diz que é a rua', async () => {
    const harness = buildHarness()
    const dependencies = {
      ...harness.dependencies,
      resolveAddressCoordinates: async () => ({ latitude: -20.5386, longitude: -47.4008 }),
    } as unknown as EnterConfirmingDependencies

    await enterConfirming({
      dependencies,
      customerPhone: PHONE,
      customerId: CUSTOMER_ID,
      checkoutContext: buildContext({ checkoutAddress: CEP_ADDRESS }),
    })

    expect(harness.locations).toHaveLength(1)
    expect(harness.locations[0]?.name).toBe(MESSAGES.CONFIRMING_SUMMARY_MAP_PIN_NAME_APPROXIMATE)
  })

  /** Geocodificador fora do ar não pode impedir o cliente de fechar a compra. */
  it('resolvedor que falha não derruba a confirmação', async () => {
    const harness = buildHarness()
    const dependencies = {
      ...harness.dependencies,
      resolveAddressCoordinates: async () => {
        throw new Error('nominatim fora do ar')
      },
    } as unknown as EnterConfirmingDependencies

    await enterConfirming({
      dependencies,
      customerPhone: PHONE,
      customerId: CUSTOMER_ID,
      checkoutContext: buildContext({ checkoutAddress: CEP_ADDRESS }),
    })

    expect(harness.locations).toEqual([])
    expect(harness.buttonMessages).toHaveLength(1)
  })

  it('não manda o mapa na retirada — quem vai à loja já sabe onde ela fica', async () => {
    const harness = buildHarness()

    await enterConfirming({
      dependencies: harness.dependencies,
      customerPhone: PHONE,
      customerId: CUSTOMER_ID,
      checkoutContext: buildContext({
        checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.PICKUP,
        checkoutDeliveryFeeInCents: 0,
        checkoutAddress: WHATSAPP_LOCATION,
      }),
    })

    expect(harness.locations).toEqual([])
  })
})
