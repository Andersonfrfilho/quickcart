/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * `handleGetContext` devolve o contexto da sessão ao painel — sem a coordenada do cliente (LGPD).
 */

import { describe, expect, it } from 'bun:test'

import { withoutContextCoordinates } from './Conversation.controller'

describe('withoutContextCoordinates', () => {
  it('omite checkoutLocationDraft e tira lat/lng dos endereços, preservando o resto', () => {
    const context = {
      step: 'awaiting_address_number',
      checkoutLocationDraft: { latitude: -23.55, longitude: -46.65 },
      checkoutAddress: { latitude: -23.55, longitude: -46.65, number: '10' },
      rememberedCheckout: {
        deliveryType: 'delivery',
        address: { latitude: -23.55, longitude: -46.65, number: '10' },
        paymentMethod: 'pix',
        receiptPreference: 'none',
      },
    }

    const result = withoutContextCoordinates(context)
    const serialized = JSON.stringify(result)

    expect(serialized).not.toContain('latitude')
    expect(serialized).not.toContain('longitude')
    expect(result).toEqual({
      step: 'awaiting_address_number',
      checkoutAddress: { number: '10' },
      rememberedCheckout: {
        deliveryType: 'delivery',
        address: { number: '10' },
        paymentMethod: 'pix',
        receiptPreference: 'none',
      },
    })
  })

  it('contexto sem endereço sai igual', () => {
    expect(withoutContextCoordinates({ step: 'idle' })).toEqual({ step: 'idle' })
  })
})
