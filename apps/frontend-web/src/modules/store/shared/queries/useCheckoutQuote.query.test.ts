/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * T4.1 (spec §3.5): entrega sem CEP completo não pode disparar a cotação — o schema do backend
 * recusaria (422) e a tela deve mostrar "Informe o CEP para calcular a taxa" em vez de um erro.
 */

import { describe, expect, it } from 'bun:test'
import { resolveCheckoutQuoteRequest } from './useCheckoutQuote.query'

const ITEMS = [{ productId: '11111111-1111-1111-1111-111111111111', quantity: 1 }]

describe('resolveCheckoutQuoteRequest', () => {
  it('retirada dispara mesmo sem CEP', () => {
    const result = resolveCheckoutQuoteRequest({ items: ITEMS, deliveryType: 'pickup' })
    expect(result.enabled).toBe(true)
    expect(result.body.cep).toBeUndefined()
  })

  it('entrega sem CEP não dispara', () => {
    const result = resolveCheckoutQuoteRequest({ items: ITEMS, deliveryType: 'delivery' })
    expect(result.enabled).toBe(false)
  })

  it('entrega com CEP incompleto não dispara', () => {
    const result = resolveCheckoutQuoteRequest({ items: ITEMS, deliveryType: 'delivery', cep: '0100' })
    expect(result.enabled).toBe(false)
  })

  it('entrega com CEP completo (com ou sem máscara) dispara e manda só dígitos', () => {
    const withDash = resolveCheckoutQuoteRequest({ items: ITEMS, deliveryType: 'delivery', cep: '01001-000' })
    expect(withDash.enabled).toBe(true)
    expect(withDash.cepDigits).toBe('01001000')
    expect(withDash.body.cep).toBe('01001000')
  })

  it('carrinho vazio não dispara, mesmo com CEP', () => {
    const result = resolveCheckoutQuoteRequest({ items: [], deliveryType: 'delivery', cep: '01001000' })
    expect(result.enabled).toBe(false)
  })
})
