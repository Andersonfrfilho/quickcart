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
import type { WhatsAppStatus } from '@adatechnology/meta-whatsapp-contracts'
import { buildDeliveryFailureLog } from './buildDeliveryFailureLog'

const RECIPIENT_PHONE = '5511988887777'
/** wamid com a forma real da Meta: base64 que embute o telefone do destinatário. */
const WAMID = 'wamid.HBgNNTUxMTk4ODg4Nzc3NxUCABEYEjBGRDc4OEMyMUFFQzM1MkFFRAA='
const WAMID_HASH = '719211e3382f0967'
const TIMESTAMP = '1759000000'

function buildStatus(overrides: Partial<WhatsAppStatus>): WhatsAppStatus {
  return { id: WAMID, status: 'failed', timestamp: TIMESTAMP, ...overrides } as WhatsAppStatus
}

describe('buildDeliveryFailureLog', () => {
  it('extrai código, título e detalhe da recusa da Meta', () => {
    const status = buildStatus({
      recipient_id: RECIPIENT_PHONE,
      errors: [
        {
          code: 131030,
          title: 'Recipient phone number not in allowed list',
          error_data: { details: 'Recipient phone number not in allowed list for this WABA.' },
        },
      ],
    })

    expect(buildDeliveryFailureLog(status)).toEqual({
      waMessageIdHash: WAMID_HASH,
      code: 131030,
      title: 'Recipient phone number not in allowed list',
      details: 'Recipient phone number not in allowed list for this WABA.',
    })
  })

  it('não carrega o telefone do cliente junto', () => {
    const status = buildStatus({ recipient_id: RECIPIENT_PHONE, errors: [{ code: 131030 }] })

    expect(JSON.stringify(buildDeliveryFailureLog(status))).not.toContain(RECIPIENT_PHONE)
  })

  it('ignora entrega que deu certo', () => {
    expect(buildDeliveryFailureLog(buildStatus({ status: 'sent' }))).toBeUndefined()
    expect(buildDeliveryFailureLog(buildStatus({ status: 'delivered' }))).toBeUndefined()
    expect(buildDeliveryFailureLog(buildStatus({ status: 'read' }))).toBeUndefined()
  })

  it('recusa sem detalhe de erro ainda aparece, só que sem o motivo', () => {
    expect(buildDeliveryFailureLog(buildStatus({}))).toEqual({
      waMessageIdHash: WAMID_HASH,
      code: undefined,
      title: undefined,
      details: undefined,
    })
  })
})
