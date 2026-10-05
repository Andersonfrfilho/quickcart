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

import { isOrderStatusRequest } from './isOrderStatusRequest'

describe('isOrderStatusRequest', () => {
  it('reconhece a pergunta embrulhada em saudação', () => {
    expect(isOrderStatusRequest('oi, bom dia, cadê meu pedido?')).toBe(true)
  })

  it('reconhece as formas comuns de perguntar', () => {
    expect(isOrderStatusRequest('onde está?')).toBe(true)
    expect(isOrderStatusRequest('Quando chega?')).toBe(true)
    expect(isOrderStatusRequest('qual o status')).toBe(true)
    expect(isOrderStatusRequest('ainda não chegou')).toBe(true)
    expect(isOrderStatusRequest('tá demorando muito')).toBe(true)
    expect(isOrderStatusRequest('já está pronto pra retirar?')).toBe(true)
  })

  it('ignora acento, caixa e pontuação', () => {
    expect(isOrderStatusRequest('CADÊ!!!')).toBe(true)
    expect(isOrderStatusRequest('cade')).toBe(true)
  })

  // "pedido" sozinho é a palavra mais comum da loja: lida como status, ela roubaria a compra nova.
  it('não confunde intenção de comprar com pergunta de status', () => {
    expect(isOrderStatusRequest('quero fazer um pedido')).toBe(false)
    expect(isOrderStatusRequest('quero fazer outro pedido')).toBe(false)
    expect(isOrderStatusRequest('me vê 2 litros de leite')).toBe(false)
  })

  it('não casa mensagem vazia', () => {
    expect(isOrderStatusRequest('')).toBe(false)
    expect(isOrderStatusRequest('   ')).toBe(false)
  })
})
