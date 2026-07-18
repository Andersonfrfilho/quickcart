/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Formato do payload do webhook da Meta Cloud API (WhatsApp Business). Não é
 * exportado pelo @adatechnology/whatsapp-provider (que só cobre o envio), então
 * modelamos aqui apenas os campos que o QuickCart de fato consome.
 */

export type WhatsAppWebhookInteractiveReply = {
  readonly id: string
  readonly title: string
}

export type WhatsAppWebhookMessage = {
  readonly from: string
  readonly id: string
  readonly timestamp: string
  readonly type: string
  readonly text?: { readonly body: string }
  readonly audio?: { readonly id: string; readonly mime_type: string }
  readonly interactive?: {
    readonly type: string
    readonly button_reply?: WhatsAppWebhookInteractiveReply
    readonly list_reply?: WhatsAppWebhookInteractiveReply
  }
}

export type WhatsAppWebhookStatus = {
  readonly id: string
  readonly status: string
  readonly timestamp: string
  readonly recipient_id: string
}

export type WhatsAppWebhookChangeValue = {
  readonly messaging_product?: string
  readonly messages?: readonly WhatsAppWebhookMessage[]
  readonly statuses?: readonly WhatsAppWebhookStatus[]
}

export type WhatsAppWebhookPayload = {
  readonly object?: string
  readonly entry?: ReadonlyArray<{
    readonly id?: string
    readonly changes?: ReadonlyArray<{
      readonly field?: string
      readonly value?: WhatsAppWebhookChangeValue
    }>
  }>
}

export type ParsedInboundMessage =
  | { readonly kind: 'text'; readonly from: string; readonly waMessageId: string; readonly body: string }
  | {
      readonly kind: 'audio'
      readonly from: string
      readonly waMessageId: string
      readonly mediaId: string
      readonly mimeType: string
    }
  | {
      readonly kind: 'button_reply'
      readonly from: string
      readonly waMessageId: string
      readonly buttonId: string
      readonly buttonTitle: string
    }
  | {
      readonly kind: 'list_reply'
      readonly from: string
      readonly waMessageId: string
      readonly listId: string
      readonly listTitle: string
    }
  | { readonly kind: 'unsupported'; readonly from: string; readonly waMessageId: string; readonly type: string }
