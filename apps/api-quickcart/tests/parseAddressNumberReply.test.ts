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
import { parseAddressNumberReply } from '@/modules/shared/address/parseAddressNumberReply'

describe('parseAddressNumberReply', () => {
  it('separa número e complemento na primeira vírgula', () => {
    expect(parseAddressNumberReply('412, apto 71')).toEqual({ number: '412', complement: 'apto 71' })
  })

  it('sem vírgula, tudo é número', () => {
    expect(parseAddressNumberReply('412')).toEqual({ number: '412' })
  })

  it('aceita "s/n" como número', () => {
    expect(parseAddressNumberReply('s/n')).toEqual({ number: 's/n' })
  })

  it('vírgula extra no complemento não é cortada — só a primeira separa', () => {
    expect(parseAddressNumberReply('412, bloco B, apto 71')).toEqual({
      number: '412',
      complement: 'bloco B, apto 71',
    })
  })

  it('complemento vazio depois da vírgula não aparece como campo', () => {
    // { complement: '' } passaria pelo addressSchema (max(80), sem min) mas seria um dado morto no
    // banco — o CheckoutHandler decide incluir o campo só quando há algo a guardar.
    const result = parseAddressNumberReply('412,')
    expect(result).toEqual({ number: '412' })
    expect(result).not.toHaveProperty('complement')
  })
})
