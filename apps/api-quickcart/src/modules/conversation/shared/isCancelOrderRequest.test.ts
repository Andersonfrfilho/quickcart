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

import { isCancelOrderRequest } from './isCancelOrderRequest'

describe('isCancelOrderRequest', () => {
  it.each([
    'cancelar o pedido',
    'cancelar pedido',
    'quero cancelar o pedido',
    'Quero cancelar minha compra',
    'queria cancelar a compra',
    'preciso cancelar meu pedido',
    'gostaria de cancelar o pedido',
  ])('entende %p como pedido de cancelamento', (text) => {
    expect(isCancelOrderRequest(text)).toBe(true)
  })

  /** "cancelar" sozinho é palavra de saída: desfazer compra fechada não pode nascer de escapar de um menu. */
  it('não confunde com a palavra de saída', () => {
    expect(isCancelOrderRequest('cancelar')).toBe(false)
    expect(isCancelOrderRequest('sair')).toBe(false)
  })

  it('não casa por substring — pergunta sobre cancelamento não é pedido de cancelamento', () => {
    expect(isCancelOrderRequest('por que o pedido foi cancelado?')).toBe(false)
    expect(isCancelOrderRequest('meu pedido foi cancelado sem eu pedir')).toBe(false)
  })

  it('ignora vazio', () => {
    expect(isCancelOrderRequest('   ')).toBe(false)
  })
})
