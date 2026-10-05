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

import { isAcknowledgement } from './isAcknowledgement'

describe('isAcknowledgement', () => {
  it('reconhece o "ok" que fecha o assunto', () => {
    expect(isAcknowledgement('ok')).toBe(true)
    expect(isAcknowledgement('OK!')).toBe(true)
    expect(isAcknowledgement('blz')).toBe(true)
    expect(isAcknowledgement('obrigado')).toBe(true)
    expect(isAcknowledgement('muito obrigada')).toBe(true)
    expect(isAcknowledgement('valeu')).toBe(true)
  })

  it('reconhece mensagem só de emoji', () => {
    expect(isAcknowledgement('👍')).toBe(true)
    expect(isAcknowledgement('🙏')).toBe(true)
  })

  /*
   * O falso positivo caro: "ok" seguido de reclamação é conversa começando, não terminando.
   * Por isso o casamento é por mensagem inteira.
   */
  it('não casa quando o ok vem com assunto', () => {
    expect(isAcknowledgement('ok, mas cadê o resto do pedido?')).toBe(false)
    expect(isAcknowledgement('obrigado, mas quero cancelar')).toBe(false)
    expect(isAcknowledgement('ok 👍 e o leite?')).toBe(false)
  })

  it('não casa mensagem vazia', () => {
    expect(isAcknowledgement('')).toBe(false)
    expect(isAcknowledgement('   ')).toBe(false)
  })
})
