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

import { CHECKOUT_QUOTE_MAX_ITEMS, CHECKOUT_QUOTE_MAX_QUANTITY_PER_ITEM } from '@/modules/store/shared/Store.constant'
import { checkoutQuoteBodySchema } from './CheckoutQuote.schema'

const ID = '11111111-1111-4111-8111-111111111111'

describe('corpo da cotação do checkout (rota pública)', () => {
  it('aceita um pedido comum', () => {
    expect(checkoutQuoteBodySchema.safeParse({ items: [{ productId: ID, quantity: 3 }], deliveryType: 'delivery' }).success).toBe(true)
  })

  it('recusa quantidade acima do teto por linha', () => {
    const corpo = { items: [{ productId: ID, quantity: CHECKOUT_QUOTE_MAX_QUANTITY_PER_ITEM + 1 }], deliveryType: 'delivery' }

    expect(checkoutQuoteBodySchema.safeParse(corpo).success).toBe(false)
  })

  it('recusa mais itens que o limite', () => {
    const items = Array.from({ length: CHECKOUT_QUOTE_MAX_ITEMS + 1 }, () => ({ productId: ID, quantity: 1 }))

    expect(checkoutQuoteBodySchema.safeParse({ items, deliveryType: 'delivery' }).success).toBe(false)
  })

  it('recusa id que não é uuid e tipo de entrega desconhecido', () => {
    expect(checkoutQuoteBodySchema.safeParse({ items: [{ productId: 'x', quantity: 1 }], deliveryType: 'delivery' }).success).toBe(false)
    expect(checkoutQuoteBodySchema.safeParse({ items: [{ productId: ID, quantity: 1 }], deliveryType: 'drone' }).success).toBe(false)
  })
})
