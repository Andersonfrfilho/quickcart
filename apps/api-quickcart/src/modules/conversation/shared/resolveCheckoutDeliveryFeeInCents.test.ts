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

import { DELIVERY_LOCATION_SOURCE } from '@/modules/order/shared/DeliveryFeeQuote.constant'
import { DELIVERY_TYPE } from '@/modules/order/shared/Order.constant'
import { resolveCheckoutDeliveryFeeInCents } from './resolveCheckoutDeliveryFeeInCents'

describe('resolveCheckoutDeliveryFeeInCents', () => {
  it('entrega sem cotação por faixa (sessão de antes do deploy) → undefined, nunca 0 nem a env', () => {
    expect(resolveCheckoutDeliveryFeeInCents({ checkoutDeliveryType: DELIVERY_TYPE.DELIVERY })).toBeUndefined()
  })

  it('entrega com a taxa antiga da env mas sem fonte da cotação → undefined', () => {
    expect(
      resolveCheckoutDeliveryFeeInCents({ checkoutDeliveryType: DELIVERY_TYPE.DELIVERY, checkoutDeliveryFeeInCents: 0 }),
    ).toBeUndefined()
  })

  it('usa a taxa cotada no contexto quando a cotação existe', () => {
    expect(
      resolveCheckoutDeliveryFeeInCents({
        checkoutDeliveryType: DELIVERY_TYPE.DELIVERY,
        checkoutDeliveryFeeInCents: 500,
        checkoutDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.CEP,
      }),
    ).toBe(500)
  })

  it('retirada sem a chave → 0', () => {
    expect(resolveCheckoutDeliveryFeeInCents({ checkoutDeliveryType: DELIVERY_TYPE.PICKUP })).toBe(0)
  })

  it('sem tipo de entrega escolhido → 0', () => {
    expect(resolveCheckoutDeliveryFeeInCents({})).toBe(0)
  })
})
