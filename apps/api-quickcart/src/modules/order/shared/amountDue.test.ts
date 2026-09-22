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

import { amountDueInCents, resolveDeliveryFeeInCents } from '@/modules/order/shared/amountDue'
import { DELIVERY_TYPE } from '@/modules/order/shared/Order.constant'

describe('resolveDeliveryFeeInCents', () => {
  it('cobra a taxa configurada na entrega', () => {
    expect(resolveDeliveryFeeInCents({ deliveryType: DELIVERY_TYPE.DELIVERY, configuredFeeInCents: 800 })).toBe(800)
  })

  it('retirada é sempre 0, mesmo com taxa configurada', () => {
    expect(resolveDeliveryFeeInCents({ deliveryType: DELIVERY_TYPE.PICKUP, configuredFeeInCents: 800 })).toBe(0)
  })
})

describe('amountDueInCents', () => {
  it('soma itens e taxa', () => {
    expect(amountDueInCents({ totalInCents: 13250, deliveryFeeInCents: 800 })).toBe(14050)
  })

  it('sem taxa, é o total dos itens', () => {
    expect(amountDueInCents({ totalInCents: 13250, deliveryFeeInCents: 0 })).toBe(13250)
  })
})
