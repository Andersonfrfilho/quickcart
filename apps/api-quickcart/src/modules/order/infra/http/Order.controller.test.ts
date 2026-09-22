/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cobre só `withAllowedTransitions` — o ponto único de serialização de pedido para fora da api
 * (lista, detalhe e as respostas de mutação), onde `requiresCardMachine` entra no DTO.
 */

import { describe, expect, it } from 'bun:test'

import { DELIVERY_TYPE, PAYMENT_METHOD } from '@/modules/order/shared/Order.constant'
import { withAllowedTransitions } from './Order.controller'

describe('withAllowedTransitions', () => {
  it('expõe requiresCardMachine = true no pedido de entrega com cartão na entrega', () => {
    const order = withAllowedTransitions({
      status: 'pending_confirmation',
      deliveryType: DELIVERY_TYPE.DELIVERY,
      paymentMethod: PAYMENT_METHOD.CARD_ON_DELIVERY,
      deliveryFailureReason: null,
    })

    expect(order.requiresCardMachine).toBe(true)
  })

  it('expõe requiresCardMachine = false na retirada com cartão na entrega', () => {
    const order = withAllowedTransitions({
      status: 'pending_confirmation',
      deliveryType: DELIVERY_TYPE.PICKUP,
      paymentMethod: PAYMENT_METHOD.CARD_ON_DELIVERY,
      deliveryFailureReason: null,
    })

    expect(order.requiresCardMachine).toBe(false)
  })
})
