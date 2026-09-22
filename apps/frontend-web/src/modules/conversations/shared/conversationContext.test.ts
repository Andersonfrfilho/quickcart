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

import { toContextEntries } from './conversationContext'

describe('toContextEntries', () => {
  it('esconde as chaves de carrinho e checkout, que o card de pedido já mostra', () => {
    const entries = toContextEntries({
      cartDraft: [{ productId: 'p1', name: 'Arroz', priceInCents: 2490, quantity: 1 }],
      checkoutDeliveryType: 'delivery',
      checkoutDeliveryFeeInCents: 800,
      checkoutAddress: { street: 'Praça da Sé', number: '10' },
      checkoutPaymentMethod: 'cash',
      checkoutCashChangeForInCents: 10000,
      customerName: 'Maria',
    })
    const keys = entries.map((entry) => entry.key)

    expect(keys).not.toContain('cartDraft')
    expect(keys).not.toContain('checkoutAddress')
    expect(keys).not.toContain('checkoutPaymentMethod')
    expect(entries.some((entry) => entry.value?.startsWith('[') || entry.value?.startsWith('{'))).toBe(false)
  })

  it('chave nova do motor continua aparecendo com o nome cru', () => {
    const entries = toContextEntries({ someNewFlag: 'sim' })
    expect(entries.find((entry) => entry.key === 'someNewFlag')?.value).toBe('sim')
  })
})
