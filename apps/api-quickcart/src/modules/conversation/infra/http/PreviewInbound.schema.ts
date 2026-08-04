/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { z } from 'zod'

export const PREVIEW_INBOUND_KIND = {
  TEXT: 'text',
  BUTTON_REPLY: 'button_reply',
  LIST_REPLY: 'list_reply',
  AUDIO: 'audio',
  MEDIA: 'media',
} as const

export const PREVIEW_INBOUND_MEDIA_TYPE = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  DOCUMENT: 'document',
  STICKER: 'sticker',
} as const

const whatsAppNumberSchema = z.string().regex(/^\d{10,15}$/)

const interactiveReplySchema = z.object({
  id: z.string().min(1).max(256),
  title: z.string().min(1).max(256),
})

/**
 * Discriminada pela intenção, e não um payload da Meta livre: a rota existe para o painel simular um
 * cliente, não para injetar webhook arbitrário. Aceitar o envelope pronto daria a qualquer sessão do
 * painel o poder de forjar `statuses`, `message_echoes` e metadata de outro número.
 */
export const previewInboundCommandSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal(PREVIEW_INBOUND_KIND.TEXT),
    from: whatsAppNumberSchema,
    text: z.string().min(1).max(4096),
  }),
  z.object({
    kind: z.literal(PREVIEW_INBOUND_KIND.BUTTON_REPLY),
    from: whatsAppNumberSchema,
    reply: interactiveReplySchema,
  }),
  z.object({
    kind: z.literal(PREVIEW_INBOUND_KIND.LIST_REPLY),
    from: whatsAppNumberSchema,
    reply: interactiveReplySchema,
  }),
  z.object({
    kind: z.literal(PREVIEW_INBOUND_KIND.AUDIO),
    from: whatsAppNumberSchema,
    mediaId: z.string().min(1).max(256),
  }),
  z.object({
    kind: z.literal(PREVIEW_INBOUND_KIND.MEDIA),
    from: whatsAppNumberSchema,
    mediaType: z.enum([
      PREVIEW_INBOUND_MEDIA_TYPE.IMAGE,
      PREVIEW_INBOUND_MEDIA_TYPE.VIDEO,
      PREVIEW_INBOUND_MEDIA_TYPE.AUDIO,
      PREVIEW_INBOUND_MEDIA_TYPE.DOCUMENT,
      PREVIEW_INBOUND_MEDIA_TYPE.STICKER,
    ]),
    mediaId: z.string().min(1).max(256),
    mimeType: z.string().max(256).optional(),
    filename: z.string().max(256).optional(),
    caption: z.string().max(1024).optional(),
  }),
])

export type PreviewInboundCommand = z.infer<typeof previewInboundCommandSchema>
