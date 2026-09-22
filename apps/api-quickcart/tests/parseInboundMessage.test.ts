/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Mensagem de localização do WhatsApp (T3.1, D2): vira `kind: 'location'` só com coordenada válida.
 */

import { describe, expect, it } from 'bun:test'
import type { WhatsAppMessage } from '@adatechnology/meta-whatsapp-contracts'

import { parseInboundMessage } from '@/modules/webhook/application/parseInboundMessage'

function buildLocationMessage(location: { readonly latitude: number; readonly longitude: number }): WhatsAppMessage {
  return { from: '5511988887777', id: 'wa-1', timestamp: '1790000000', type: 'location', location }
}

describe('parseInboundMessage — localização', () => {
  it('localização com coordenada válida vira kind location', () => {
    expect(parseInboundMessage(buildLocationMessage({ latitude: -23.5613, longitude: -46.6565 }))).toEqual({
      kind: 'location',
      from: '5511988887777',
      waMessageId: 'wa-1',
      latitude: -23.5613,
      longitude: -46.6565,
    })
  })

  it('coordenada fora da faixa cai em unsupported', () => {
    expect(parseInboundMessage(buildLocationMessage({ latitude: 123, longitude: -46.6565 })).kind).toBe('unsupported')
  })

  it('type location sem o objeto location cai em unsupported', () => {
    expect(parseInboundMessage({ from: '5511988887777', id: 'wa-1', timestamp: '1790000000', type: 'location' }).kind).toBe(
      'unsupported',
    )
  })
})
