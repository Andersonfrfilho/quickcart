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
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'
import { buildItemSubstitutionButtons, buildItemSubstitutionRows } from '@/modules/conversation/shared/orderDecisionButton'
import { parseOrderDecisionReply } from '@/modules/conversation/shared/orderDecisionReply'

const base = { from: '5511999999999', waMessageId: 'wamid-1' }

describe('parseOrderDecisionReply', () => {
  it('lê o toque no botão de troca', () => {
    const [substitute] = buildItemSubstitutionButtons({
      orderId: 'order-1',
      orderItemId: 'item-1',
      substituteProductId: 'product-2',
    })

    const decision = parseOrderDecisionReply({
      ...base,
      kind: 'button_reply',
      buttonId: substitute?.id ?? '',
      buttonTitle: '🔄 Trocar',
    } as ParsedInboundMessage)

    expect(decision).toEqual({
      decision: 'substitute',
      orderId: 'order-1',
      orderItemId: 'item-1',
      substituteProductId: 'product-2',
    })
  })

  it('lê o toque na linha da lista de parecidos', () => {
    const [firstRow] = buildItemSubstitutionRows({
      orderId: 'order-1',
      orderItemId: 'item-1',
      substitutes: [{ productId: 'product-3', title: 'União Açúcar', description: 'R$ 9,00' }],
    })

    const decision = parseOrderDecisionReply({
      ...base,
      kind: 'list_reply',
      listId: firstRow?.id ?? '',
      listTitle: 'União Açúcar',
    } as ParsedInboundMessage)

    expect(decision).toEqual({
      decision: 'substitute',
      orderId: 'order-1',
      orderItemId: 'item-1',
      substituteProductId: 'product-3',
    })
  })

  it('texto livre e id de outro assunto não são decisão de pedido', () => {
    expect(parseOrderDecisionReply({ ...base, kind: 'text', body: 'trocar' } as ParsedInboundMessage)).toBeUndefined()
    expect(
      parseOrderDecisionReply({
        ...base,
        kind: 'button_reply',
        buttonId: 'menu:repeat_order',
        buttonTitle: 'Repetir',
      } as ParsedInboundMessage),
    ).toBeUndefined()
  })
})
