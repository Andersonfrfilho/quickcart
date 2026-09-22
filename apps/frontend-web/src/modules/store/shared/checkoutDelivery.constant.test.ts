/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * T4.1 (spec §3.5): os dois erros de `CreateWebOrder` (taxa mudou / fora do raio) e a mensagem no
 * lugar da taxa mostram sempre o texto certo, via `getApiErrorCode()`.
 */

import { describe, expect, it } from 'bun:test'
import {
  CHECKOUT_DELIVERY_QUOTE_TEXT,
  DELIVERY_FEE_CHANGED_CODE,
  DELIVERY_OUT_OF_RANGE_CODE,
  resolveCreateOrderErrorMessage,
  resolveDeliveryQuoteMessage,
} from './checkoutDelivery.constant'
import type { CheckoutQuote } from '@/shared/api/api.types'

function quotedFor(kind: CheckoutQuote['deliveryQuote']['kind']): CheckoutQuote {
  const base = { subtotalInCents: 1000, deliveryFeeInCents: 0, amountDueInCents: 1000, items: [] }
  if (kind === 'out_of_range') {
    return { ...base, isDeliveryAvailable: false, deliveryQuote: { kind, distanceKm: 12, maxDistanceKm: 8 } }
  }
  if (kind === 'unavailable') {
    return { ...base, isDeliveryAvailable: false, deliveryQuote: { kind } }
  }
  return { ...base, isDeliveryAvailable: true, deliveryQuote: { kind: 'pickup' } }
}

describe('resolveDeliveryQuoteMessage', () => {
  it('sem CEP completo, pede o CEP', () => {
    expect(resolveDeliveryQuoteMessage({ deliveryType: 'delivery', cep: '0100', quote: undefined })).toBe(
      CHECKOUT_DELIVERY_QUOTE_TEXT.MISSING_CEP,
    )
  })

  it('retirada nunca mostra mensagem', () => {
    expect(resolveDeliveryQuoteMessage({ deliveryType: 'pickup', cep: '', quote: undefined })).toBeNull()
  })

  it('fora do raio explica e sugere retirada', () => {
    expect(
      resolveDeliveryQuoteMessage({ deliveryType: 'delivery', cep: '01001000', quote: quotedFor('out_of_range') }),
    ).toBe(CHECKOUT_DELIVERY_QUOTE_TEXT.OUT_OF_RANGE)
  })

  it('indisponível explica o motivo genérico', () => {
    expect(
      resolveDeliveryQuoteMessage({ deliveryType: 'delivery', cep: '01001000', quote: quotedFor('unavailable') }),
    ).toBe(CHECKOUT_DELIVERY_QUOTE_TEXT.UNAVAILABLE)
  })

  it('CEP completo sem cotação ainda chegada não mostra nada (carregando)', () => {
    expect(resolveDeliveryQuoteMessage({ deliveryType: 'delivery', cep: '01001000', quote: undefined })).toBeNull()
  })
})

describe('resolveCreateOrderErrorMessage', () => {
  it('DELIVERY_FEE_CHANGED recota e avisa que a taxa mudou', () => {
    const result = resolveCreateOrderErrorMessage({ code: DELIVERY_FEE_CHANGED_CODE, fallbackMessage: 'erro' })
    expect(result.message).toBe(CHECKOUT_DELIVERY_QUOTE_TEXT.FEE_CHANGED)
    expect(result.shouldRefetchQuote).toBe(true)
  })

  it('DELIVERY_OUT_OF_RANGE avisa fora do raio, sem recotar', () => {
    const result = resolveCreateOrderErrorMessage({ code: DELIVERY_OUT_OF_RANGE_CODE, fallbackMessage: 'erro' })
    expect(result.message).toBe(CHECKOUT_DELIVERY_QUOTE_TEXT.OUT_OF_RANGE)
    expect(result.shouldRefetchQuote).toBe(false)
  })

  it('outros códigos caem no texto do erro original', () => {
    const result = resolveCreateOrderErrorMessage({ code: undefined, fallbackMessage: 'Estoque insuficiente' })
    expect(result.message).toBe('Estoque insuficiente')
    expect(result.shouldRefetchQuote).toBe(false)
  })
})
