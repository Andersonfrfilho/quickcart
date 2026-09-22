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

import { DELIVERY_TYPE } from '@/modules/order/shared/Order.constant'
import { resolveCheckoutDeliveryFeeInCents } from './resolveCheckoutDeliveryFeeInCents'

describe('resolveCheckoutDeliveryFeeInCents', () => {
  it('contexto sem a chave + entrega + taxa configurada 800 → 800, não 0', () => {
    expect(resolveCheckoutDeliveryFeeInCents({ context: { checkoutDeliveryType: DELIVERY_TYPE.DELIVERY }, configuredFeeInCents: 800 })).toBe(800)
  })

  it('usa a taxa cotada no contexto quando existe, mesmo que a configurada tenha mudado', () => {
    expect(
      resolveCheckoutDeliveryFeeInCents({
        context: { checkoutDeliveryType: DELIVERY_TYPE.DELIVERY, checkoutDeliveryFeeInCents: 500 },
        configuredFeeInCents: 800,
      }),
    ).toBe(500)
  })

  it('retirada sem a chave → 0', () => {
    expect(resolveCheckoutDeliveryFeeInCents({ context: { checkoutDeliveryType: DELIVERY_TYPE.PICKUP }, configuredFeeInCents: 800 })).toBe(0)
  })

  it('sem tipo de entrega escolhido → 0', () => {
    expect(resolveCheckoutDeliveryFeeInCents({ context: {}, configuredFeeInCents: 800 })).toBe(0)
  })
})
