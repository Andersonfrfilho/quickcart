/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O contrato que importa é o mesmo do áudio: nunca devolver menos do que chegou. Foto ilegível,
 * produto ausente e provider fora do ar precisam degradar para o comportamento de hoje, não somem
 * com a mensagem do cliente.
 */

import { describe, expect, it } from 'bun:test'
import {
  createInboundImageResolver,
  type ProductIdentification,
} from '@/modules/conversation/application/resolveInboundImage'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'

const PHONE = '5511977770001'

const imageMessage: ParsedInboundMessage = {
  kind: 'image',
  from: PHONE,
  waMessageId: 'wamid.image.1',
  mediaId: 'media-1',
  mimeType: 'image/jpeg',
}

function build(identification?: ProductIdentification | Error) {
  const notices: string[] = []
  const resolve = createInboundImageResolver({
    ...(identification === undefined
      ? {}
      : {
          identifyProduct: async () => {
            if (identification instanceof Error) throw identification
            return identification
          },
        }),
    fetchMediaAsBase64: async () => ({ data: Buffer.from('foto').toString('base64'), mimeType: 'image/jpeg' }),
    sendNotice: async (_to: string, body: string) => {
      notices.push(body)
    },
  })

  return { resolve, notices }
}

describe('produto identificado', () => {
  it('vira o texto que o cliente teria digitado', async () => {
    // É o que faz o ListHandler e o BrowseHandler funcionarem sem uma linha nova.
    const { resolve } = build({ outcome: 'identified', productName: 'Leite Integral Itambé 1L' })

    const resolved = await resolve({ message: imageMessage, whatsappNumber: PHONE })

    expect(resolved).toEqual({
      kind: 'text',
      from: PHONE,
      waMessageId: 'wamid.image.1',
      body: 'Leite Integral Itambé 1L',
    })
  })
})

describe('degradação — nunca devolve menos do que chegou', () => {
  it('sem a capacidade ligada, a foto segue crua', async () => {
    const { resolve, notices } = build(undefined)

    expect(await resolve({ message: imageMessage, whatsappNumber: PHONE })).toBe(imageMessage)
    expect(notices).toEqual([])
  })

  it('provider fora do ar devolve a mensagem original, sem derrubar a conversa', async () => {
    const { resolve } = build(new Error('engine caiu'))

    expect(await resolve({ message: imageMessage, whatsappNumber: PHONE })).toBe(imageMessage)
  })

  it('produto não encontrado explica o que fazer, e devolve o original', async () => {
    const { resolve, notices } = build({ outcome: 'unmatched' })

    expect(await resolve({ message: imageMessage, whatsappNumber: PHONE })).toBe(imageMessage)
    expect(notices).toEqual([MESSAGES.IMAGE_PRODUCT_NOT_FOUND])
  })

  it('vários candidatos viram pergunta numerada, e a resposta entra como texto normal', async () => {
    const { resolve, notices } = build({
      outcome: 'candidates',
      candidates: [
        { id: 'a', name: 'Leite Integral 1L' },
        { id: 'b', name: 'Leite Desnatado 1L' },
      ],
    })

    expect(await resolve({ message: imageMessage, whatsappNumber: PHONE })).toBe(imageMessage)
    expect(notices[0]).toContain('1. Leite Integral 1L')
    expect(notices[0]).toContain('2. Leite Desnatado 1L')
  })

  it('mensagem que não é imagem passa intacta', async () => {
    const text: ParsedInboundMessage = { kind: 'text', from: PHONE, waMessageId: 'w1', body: 'arroz' }
    const { resolve } = build({ outcome: 'identified', productName: 'nunca usado' })

    expect(await resolve({ message: text, whatsappNumber: PHONE })).toBe(text)
  })
})
