/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cola HTTP sobre os use-cases do @adatechnology/meta-whatsapp-module para atender o contrato
 * ConversationsApi do @adatechnology/conversations-ui. Nenhuma regra de conversa vive aqui: o
 * controller traduz request/response e nada mais.
 *
 * O identificador de conversa na URL é o número de WhatsApp, que é como o módulo indexa
 * (companyId + whatsappNumber). Usar o id da sessão obrigaria um lookup extra em toda rota.
 */

import type { MetaWhatsAppModule } from '@adatechnology/meta-whatsapp-module'
import type { MessageRow } from '@adatechnology/meta-whatsapp-module'
import type { RouteHandler } from '@/infra/http/router'
import { requireAdminToken } from '@/infra/http/middlewares/requireAdminToken'
import { environment } from '@/infra/config/environment'
import { ValidationError, NotFoundError } from '@/shared/errors/AppError.error'
import { CONVERSATION_NOT_FOUND, VALIDATION_ERROR } from '@/shared/errors/codes'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'

const COMPANY_ID = environment.WHATSAPP_COMPANY_ID
const DEFAULT_MESSAGE_LIMIT = 50
const MAX_MESSAGE_LIMIT = 100

type ConversationControllerDependencies = {
  readonly metaWhatsApp: MetaWhatsAppModule
}

// O conversations-ui espera `content`/`sentAt`; a linha do módulo usa `content`/`createdAt`.
function toMessagePayload(row: MessageRow) {
  return {
    id: row.id,
    conversationId: row.whatsappNumber,
    direction: row.direction,
    sender: row.sender,
    type: row.type,
    content: row.content,
    payload: row.payload,
    waMessageId: row.waMessageId,
    status: row.status,
    sentAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  }
}

function requireNumber(request: { readonly params: readonly string[] }): string {
  const whatsappNumber = request.params[0]
  if (!whatsappNumber) throw new ValidationError('Número de WhatsApp ausente na rota', VALIDATION_ERROR)
  return whatsappNumber
}

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_MESSAGE_LIMIT
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_MESSAGE_LIMIT
  return Math.min(parsed, MAX_MESSAGE_LIMIT)
}

export class ConversationController {
  constructor(private readonly dependencies: ConversationControllerDependencies) {}

  handleList: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const search = request.query.get('search')
    const waitingHuman = request.query.get('waitingHuman')

    const conversations = await this.dependencies.metaWhatsApp.conversations.list.execute({
      companyId: COMPANY_ID,
      filters: {
        ...(search ? { search } : {}),
        ...(waitingHuman === 'true' ? { waitingHuman: true } : {}),
      },
    })

    response.json(200, { data: conversations })
  }

  handleListMessages: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const before = request.query.get('before')

    const messages = await this.dependencies.metaWhatsApp.conversations.listMessages.execute({
      companyId: COMPANY_ID,
      whatsappNumber: requireNumber(request),
      limit: parseLimit(request.query.get('limit')),
      ...(before ? { before } : {}),
    })

    response.json(200, { data: messages.map(toMessagePayload) })
  }

  handleSendText: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const body = request.body as { text?: unknown }
    if (typeof body?.text !== 'string' || body.text.trim() === '') {
      throw new ValidationError('Campo `text` é obrigatório', VALIDATION_ERROR)
    }

    const sent = await this.dependencies.metaWhatsApp.conversations.send.sendText({
      companyId: COMPANY_ID,
      whatsappNumber: requireNumber(request),
      body: body.text,
      // 'agent': saiu da inbox, por um humano. O bot usa o WhatsAppSender, não esta rota — a
      // distinção é o que permite a thread mostrar quem falou.
      sender: 'agent',
      startState: CONVERSATION_STATE.GREETING,
    })

    if (!sent) throw new NotFoundError('Conversa não encontrada', CONVERSATION_NOT_FOUND)
    response.json(201, { data: toMessagePayload(sent) })
  }

  // Sem object storage no QuickCart: o binário chega em base64, vai direto para a Meta pelo
  // uploadMedia do provider e não é persistido em lugar nenhum nosso.
  handleSendMedia: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const body = request.body as { base64?: unknown; mimeType?: unknown; filename?: unknown; caption?: unknown }
    if (typeof body?.base64 !== 'string' || typeof body?.mimeType !== 'string' || typeof body?.filename !== 'string') {
      throw new ValidationError('Campos `base64`, `mimeType` e `filename` são obrigatórios', VALIDATION_ERROR)
    }

    const sent = await this.dependencies.metaWhatsApp.conversations.send.sendMedia({
      companyId: COMPANY_ID,
      whatsappNumber: requireNumber(request),
      buffer: Buffer.from(body.base64, 'base64'),
      mimeType: body.mimeType,
      filename: body.filename,
      ...(typeof body.caption === 'string' ? { caption: body.caption } : {}),
      sender: 'agent',
      startState: CONVERSATION_STATE.GREETING,
    })

    if (!sent) throw new NotFoundError('Conversa não encontrada', CONVERSATION_NOT_FOUND)
    response.json(201, { data: toMessagePayload(sent) })
  }

  handleSendTemplate: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const body = request.body as { templateName?: unknown; languageCode?: unknown; bodyParams?: unknown }
    if (typeof body?.templateName !== 'string') {
      throw new ValidationError('Campo `templateName` é obrigatório', VALIDATION_ERROR)
    }

    await this.dependencies.metaWhatsApp.conversations.send.sendTemplate({
      companyId: COMPANY_ID,
      whatsappNumber: requireNumber(request),
      templateName: body.templateName,
      ...(typeof body.languageCode === 'string' ? { languageCode: body.languageCode } : {}),
      ...(Array.isArray(body.bodyParams) ? { bodyParams: body.bodyParams as string[] } : {}),
      sender: 'agent',
      startState: CONVERSATION_STATE.GREETING,
    })

    response.json(204, { data: null })
  }

  handleMarkRead: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    await this.dependencies.metaWhatsApp.conversations.repository.markRead(COMPANY_ID, requireNumber(request))
    response.json(204, { data: null })
  }

  handleGetContext: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const session = await this.dependencies.metaWhatsApp.conversations.repository.getContext(
      COMPANY_ID,
      requireNumber(request),
    )
    if (!session) throw new NotFoundError('Conversa não encontrada', CONVERSATION_NOT_FOUND)

    response.json(200, { data: session.context })
  }

  // Assume a conversa para atendimento humano: o módulo passa mode='human' e, a partir daí,
  // o webhook para de entregar mensagens ao bot (ver ReceiveWebhook.use-case).
  handleTakeover: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const body = request.body as { agentUserId?: unknown }
    if (typeof body?.agentUserId !== 'string') {
      throw new ValidationError('Campo `agentUserId` é obrigatório', VALIDATION_ERROR)
    }

    await this.dependencies.metaWhatsApp.conversations.takeover.execute({
      companyId: COMPANY_ID,
      whatsappNumber: requireNumber(request),
      agentUserId: body.agentUserId,
    })

    response.json(204, { data: null })
  }

  handleRelease: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    await this.dependencies.metaWhatsApp.conversations.release.execute({
      companyId: COMPANY_ID,
      whatsappNumber: requireNumber(request),
    })

    response.json(204, { data: null })
  }

  // Proxy de mídia: busca da Meta sob demanda em vez de guardar o binário. Cobre reouvir o
  // áudio da lista de compras na inbox — que é o caso que importa aqui — ao custo de só servir
  // mídia recente, já que a Meta expira o conteúdo em ~30 dias.
  handleMediaProxy: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const mediaId = request.params[0]
    if (!mediaId) throw new ValidationError('mediaId ausente na rota', VALIDATION_ERROR)

    const media = await this.dependencies.metaWhatsApp.channel.fetchMediaAsBase64(mediaId)
    response.json(200, { data: media })
  }
}
