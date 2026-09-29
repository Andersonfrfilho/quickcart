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
import { hashWaMessageId } from '@/shared/hashWaMessageId'
import { parseFailedDeliveries } from './parseFailedDeliveries'

const RECIPIENT_PHONE = '5511988887777'
/** wamid com a forma real da Meta: base64 que embute o telefone do destinatário. */
const WAMID = 'wamid.HBgNNTUxMTk4ODg4Nzc3NxUCABEYEjBGRDc4OEMyMUFFQzM1MkFFRAA='
const WAMID_HASH = '719211e3382f0967'

function buildStatusWebhook(statuses: readonly unknown[]): string {
  return JSON.stringify({ entry: [{ changes: [{ value: { statuses } }] }] })
}

describe('parseFailedDeliveries', () => {
  it('extrai código, título e detalhe da recusa da Meta', () => {
    const rawBody = buildStatusWebhook([
      {
        id: WAMID,
        status: 'failed',
        recipient_id: RECIPIENT_PHONE,
        errors: [
          {
            code: 131030,
            title: 'Recipient phone number not in allowed list',
            error_data: { details: 'Recipient phone number not in allowed list for this WABA.' },
          },
        ],
      },
    ])

    expect(parseFailedDeliveries(rawBody)).toEqual([
      {
        waMessageIdHash: WAMID_HASH,
        code: 131030,
        title: 'Recipient phone number not in allowed list',
        details: 'Recipient phone number not in allowed list for this WABA.',
      },
    ])
  })

  it('não carrega o telefone do cliente junto', () => {
    const rawBody = buildStatusWebhook([
      { id: WAMID, status: 'failed', recipient_id: RECIPIENT_PHONE, errors: [{ code: 131030 }] },
    ])

    expect(JSON.stringify(parseFailedDeliveries(rawBody))).not.toContain(RECIPIENT_PHONE)
  })

  it('ignora entrega bem-sucedida', () => {
    const rawBody = buildStatusWebhook([
      { id: 'wamid.A', status: 'sent' },
      { id: 'wamid.B', status: 'delivered' },
      { id: 'wamid.C', status: 'read' },
    ])

    expect(parseFailedDeliveries(rawBody)).toEqual([])
  })

  it('separa a recusa no meio de entregas que deram certo', () => {
    const rawBody = buildStatusWebhook([
      { id: 'wamid.A', status: 'delivered' },
      { id: 'wamid.B', status: 'failed', errors: [{ code: 131047, title: 'Re-engagement message' }] },
    ])

    const failures = parseFailedDeliveries(rawBody)

    expect(failures).toHaveLength(1)
    expect(failures[0]?.waMessageIdHash).toBe(hashWaMessageId('wamid.B'))
    expect(failures[0]?.code).toBe(131047)
  })

  it('recusa sem detalhe de erro ainda aparece, só que sem o motivo', () => {
    const rawBody = buildStatusWebhook([{ id: 'wamid.A', status: 'failed' }])

    expect(parseFailedDeliveries(rawBody)).toEqual([
      { waMessageIdHash: hashWaMessageId('wamid.A'), code: undefined, title: undefined, details: undefined },
    ])
  })

  it('corpo que não é JSON devolve lista vazia em vez de estourar', () => {
    expect(parseFailedDeliveries('<html>502 Bad Gateway</html>')).toEqual([])
  })

  it('corpo com formato inesperado devolve lista vazia', () => {
    expect(parseFailedDeliveries(JSON.stringify({ entry: 'não é lista' }))).toEqual([])
    expect(parseFailedDeliveries(JSON.stringify({ object: 'whatsapp_business_account' }))).toEqual([])
  })

  it('webhook de mensagem recebida não produz falha nenhuma', () => {
    const rawBody = JSON.stringify({
      entry: [{ changes: [{ value: { messages: [{ id: 'wamid.X', type: 'text' }] } }] }],
    })

    expect(parseFailedDeliveries(rawBody)).toEqual([])
  })
})
