/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type {
  ParsedInboundMessage,
  WhatsAppWebhookMessage,
} from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'

export function parseInboundMessage(message: WhatsAppWebhookMessage): ParsedInboundMessage {
  const { from, id: waMessageId, type } = message

  if (type === 'text' && message.text) {
    return { kind: 'text', from, waMessageId, body: message.text.body }
  }

  if (type === 'audio' && message.audio) {
    return { kind: 'audio', from, waMessageId, mediaId: message.audio.id, mimeType: message.audio.mime_type }
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
