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

import { DELIVERY_TYPE, PAYMENT_METHOD } from '@/modules/order/shared/Order.constant'
import { requiresCardMachine } from '@/modules/order/shared/requiresCardMachine'

describe('requiresCardMachine', () => {
  it('retorna true na entrega com cartão na entrega', () => {
    expect(
      requiresCardMachine({ paymentMethod: PAYMENT_METHOD.CARD_ON_DELIVERY, deliveryType: DELIVERY_TYPE.DELIVERY }),
    ).toBe(true)
  })

  it('retorna false na retirada com cartão na entrega', () => {
    expect(
      requiresCardMachine({ paymentMethod: PAYMENT_METHOD.CARD_ON_DELIVERY, deliveryType: DELIVERY_TYPE.PICKUP }),
    ).toBe(false)
  })

  it('retorna false na entrega com pix', () => {
    expect(requiresCardMachine({ paymentMethod: PAYMENT_METHOD.PIX, deliveryType: DELIVERY_TYPE.DELIVERY })).toBe(false)
  })

  it('retorna false na entrega com dinheiro', () => {
    expect(requiresCardMachine({ paymentMethod: PAYMENT_METHOD.CASH, deliveryType: DELIVERY_TYPE.DELIVERY })).toBe(false)
  })
})
