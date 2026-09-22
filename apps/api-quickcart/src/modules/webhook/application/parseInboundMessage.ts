/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { WhatsAppMessage } from '@adatechnology/meta-whatsapp-contracts'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'

// Recebe a mensagem crua da Meta já validada pelo módulo e a reduz à união fechada que os
// handlers do QuickCart entendem. Tudo que a loja não trata (documento, sticker, pedido de
// catálogo) cai em 'unsupported'.
export function parseInboundMessage(message: WhatsAppMessage): ParsedInboundMessage {
  const { from, id: waMessageId, type } = message

  if (type === 'text' && message.text) {
    return { kind: 'text', from, waMessageId, body: message.text.body }
  }

  if (type === 'audio' && message.audio) {
    return { kind: 'audio', from, waMessageId, mediaId: message.audio.id, mimeType: message.audio.mime_type }
  }

  if (type === 'image' && message.image) {
    return {
      kind: 'image',
      from,
      waMessageId,
      mediaId: message.image.id,
      mimeType: message.image.mime_type,
      ...(message.image.caption ? { caption: message.image.caption } : {}),
    }
  }

  if (type === 'interactive' && message.interactive?.type === 'button_reply' && message.interactive.button_reply) {
    const { id, title } = message.interactive.button_reply
    return { kind: 'button_reply', from, waMessageId, buttonId: id, buttonTitle: title }
  }

  if (type === 'interactive' && message.interactive?.type === 'list_reply' && message.interactive.list_reply) {
    const { id, title } = message.interactive.list_reply
    return { kind: 'list_reply', from, waMessageId, listId: id, listTitle: title }
  }

  return { kind: 'unsupported', from, waMessageId, type }
}
