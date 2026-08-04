/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Entrega no webhook uma mensagem inbound simulada pelo painel de conversas.
 *
 * A assinatura é gerada AQUI, com o app secret que só o servidor tem. Antes o simulador assinava no
 * navegador, o que exigia `VITE_PREVIEW_APP_SECRET` — e `VITE_*` é literal inlinado no bundle, ou
 * seja, o app secret ia junto com o JavaScript para qualquer um que baixasse a página.
 *
 * Diferente das outras rotas de preview (transcript e mídia), que existem para a aba do cliente sem
 * sessão e por isso se autenticam por HMAC, esta é do PAINEL: quem chama já tem token de admin, e é
 * ele que autoriza. Forjar um inbound é escrever no transcript de um cliente.
 *
 * De lá a entrega passa pelo mesmo webhook de verdade, com a mesma verificação de assinatura e a
 * mesma guarda de replay: um caminho paralelo testaria outra coisa.
 */

import { createHmac } from 'node:crypto'
import {
  buildInboundAudioPayload,
  buildInboundInteractivePayload,
  buildInboundMediaPayload,
  buildInboundTextPayload,
  serializeWebhookPayload,
} from '@adatechnology/meta-whatsapp-contracts/testing'
import type { MetaWhatsAppModule } from '@adatechnology/meta-whatsapp-module'

import type { RouteHandler } from '@/infra/http/router'
import { environment } from '@/infra/config/environment'
import { requireAdminToken } from '@/infra/http/middlewares/requireAdminToken'
import { previewInboundCommandSchema, PREVIEW_INBOUND_KIND } from './PreviewInbound.schema'
import type { PreviewInboundCommand } from './PreviewInbound.schema'

const NOT_FOUND = { error: { code: 'NOT_FOUND', message: 'Recurso não encontrado' } }

function buildPayload(command: PreviewInboundCommand) {
  const envelope = { from: command.from }

  switch (command.kind) {
    case PREVIEW_INBOUND_KIND.TEXT:
      return buildInboundTextPayload({ ...envelope, text: command.text })
    case PREVIEW_INBOUND_KIND.BUTTON_REPLY:
      return buildInboundInteractivePayload({ ...envelope, buttonReply: command.reply })
    case PREVIEW_INBOUND_KIND.LIST_REPLY:
      return buildInboundInteractivePayload({ ...envelope, listReply: command.reply })
    case PREVIEW_INBOUND_KIND.AUDIO:
      return buildInboundAudioPayload({ ...envelope, mediaId: command.mediaId })
    case PREVIEW_INBOUND_KIND.MEDIA:
      return buildInboundMediaPayload({
        ...envelope,
        mediaType: command.mediaType,
        mediaId: command.mediaId,
        ...(command.mimeType ? { mimeType: command.mimeType } : {}),
        ...(command.filename ? { filename: command.filename } : {}),
        ...(command.caption ? { caption: command.caption } : {}),
      })
  }
}

export function createPreviewInboundController(metaWhatsApp: MetaWhatsAppModule) {
  const handleSend: RouteHandler = async (request, response) => {
    const appSecret = environment.WHATSAPP_APP_SECRET
    // 404 e não 403, como as demais rotas de preview: desligada, ela não se anuncia.
    if (!environment.PREVIEW_TRANSCRIPT_ENABLED || !appSecret) {
      response.json(404, NOT_FOUND)
      return
    }

    requireAdminToken(request)

    const command = previewInboundCommandSchema.parse(request.body)
    const rawBody = serializeWebhookPayload(buildPayload(command))
    const signature = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`

    await metaWhatsApp.webhook.receive.execute({
      companyId: environment.WHATSAPP_COMPANY_ID,
      rawBody: Buffer.from(rawBody),
      signatureHeader: signature,
    })

    response.json(202, { data: { status: 'accepted' } })
  }

  return { handleSend }
}
