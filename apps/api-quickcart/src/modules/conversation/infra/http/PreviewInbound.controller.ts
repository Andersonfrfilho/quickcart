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
 * São dois handlers, com autorização diferente porque quem chama é diferente:
 *
 * - `handleSend` é do PAINEL: quem chama tem token de admin, e é ele que autoriza. Forjar um inbound
 *   é escrever no transcript de um cliente.
 * - `handleSendFromPreview` é da aba do cliente (`CustomerPreview.page`), que não tem sessão — a
 *   guarda é `PREVIEW_TRANSCRIPT_ENABLED`, desligada em staging e produção, igual às demais rotas
 *   de preview. Antes essa aba assinava no navegador, o que exigia o app secret no bundle; a chave
 *   publicada não protegia rota nenhuma, já que quem baixava a página conseguia assinar.
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
import { requireSession } from '@/infra/http/middlewares/requireSession'
import { ADMIN_AND_ATTENDANT } from '@/modules/user/shared/User.constant'
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
  async function deliver(request: Parameters<RouteHandler>[0], response: Parameters<RouteHandler>[1]) {
    const appSecret = environment.WHATSAPP_APP_SECRET
    // 404 e não 403, como as demais rotas de preview: desligada, ela não se anuncia.
    if (!environment.PREVIEW_TRANSCRIPT_ENABLED || !appSecret) {
      response.json(404, NOT_FOUND)
      return
    }

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

  const handleSend: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ADMIN_AND_ATTENDANT })
    await deliver(request, response)
  }

  // Sem token: a aba do cliente não tem sessão. Quem autoriza é a flag de servidor.
  const handleSendFromPreview: RouteHandler = async (request, response) => {
    await deliver(request, response)
  }

  return { handleSend, handleSendFromPreview }
}
