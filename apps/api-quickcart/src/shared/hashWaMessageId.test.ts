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
import { hashWaMessageId } from './hashWaMessageId'

/** `wamid` real de um envio recusado, cujo base64 embute o telefone do destinatário. */
const WAMID_WITH_EMBEDDED_PHONE = 'wamid.HBgNNTUxNjk5MzA1Njc3MhUCABEYEjBGRDc4OEMyMUFFQzM1MkFFRAA='
const EMBEDDED_PHONE = '5516993056772'

describe('hashWaMessageId', () => {
  it('não deixa o telefone embutido no wamid chegar ao log', () => {
    const hashed = hashWaMessageId(WAMID_WITH_EMBEDDED_PHONE)

    expect(Buffer.from(WAMID_WITH_EMBEDDED_PHONE.replace('wamid.', ''), 'base64').toString('latin1')).toContain(
      EMBEDDED_PHONE,
    )
    expect(hashed).not.toContain(EMBEDDED_PHONE)
    expect(Buffer.from(hashed ?? '', 'hex').toString('latin1')).not.toContain(EMBEDDED_PHONE)
  })

  it('é estável: o mesmo envio produz sempre a mesma chave de correlação', () => {
    expect(hashWaMessageId(WAMID_WITH_EMBEDDED_PHONE)).toBe(hashWaMessageId(WAMID_WITH_EMBEDDED_PHONE))
  })

  it('separa envios diferentes', () => {
    expect(hashWaMessageId('wamid.AAA')).not.toBe(hashWaMessageId('wamid.BBB'))
  })

  it('devolve undefined quando a Meta não mandou id', () => {
    expect(hashWaMessageId(undefined)).toBeUndefined()
  })
})
