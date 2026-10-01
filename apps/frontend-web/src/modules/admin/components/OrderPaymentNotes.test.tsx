/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Critérios 1 e 3 no painel (T4.2): o trecho de pagamento do `OrderDetailView` mostra o selo da
 * maquininha e a linha de troco só quando o backend manda.
 */

import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { OrderPaymentNotes } from './OrderPaymentNotes'

describe('OrderPaymentNotes', () => {
  it('requiresCardMachine true: selo "Levar maquininha" presente', () => {
    expect(renderToStaticMarkup(<OrderPaymentNotes cashChangeForInCents={null} requiresCardMachine />)).toContain('Levar maquininha')
  })

  it('requiresCardMachine false: selo ausente', () => {
    expect(renderToStaticMarkup(<OrderPaymentNotes cashChangeForInCents={null} requiresCardMachine={false} />)).not.toContain('Levar maquininha')
  })

  it('com cashChangeForInCents: linha "Troco para" com o valor', () => {
    const html = renderToStaticMarkup(<OrderPaymentNotes cashChangeForInCents={15000} requiresCardMachine={false} />)

    expect(html).toContain('Troco para')
    expect(html).toContain('150,00')
  })

  it('sem troco (null): linha ausente', () => {
    expect(renderToStaticMarkup(<OrderPaymentNotes cashChangeForInCents={null} requiresCardMachine={false} />)).not.toContain('Troco para')
  })
})
