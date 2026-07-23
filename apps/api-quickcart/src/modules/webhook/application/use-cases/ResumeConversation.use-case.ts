/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Chamada pelo worker-quickcart depois do processor `stt` transcrever um áudio
 * (T6.3): injeta o transcript de volta no motor de conversa como se fosse uma
 * mensagem de texto do cliente. Sessão é resolvida por id (não por telefone) porque
 * o worker só tem o `sessionId` enfileirado junto do `mediaId` — o telefone só é
 * conhecido depois de carregar a sessão.
 */

import { generateId } from '@/shared/id'
import { logger } from '@/shared/logger'
import { LOG_EVENTS } from '@/shared/constants/log-events.constant'
import { NotFoundError } from '@/shared/errors/AppError.error'
import { CONVERSATION_NOT_FOUND } from '@/shared/errors/codes'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { MessageRepositoryInterface } from '@/modules/webhook/domain/MessageRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import type { ConversationEngine } from '@/modules/conversation/application/ConversationEngine'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import type { ResumeConversationParams, ResumeConversationResult } from '../types/ResumeConversation.types'

const resumeLog = logger.child('ResumeConversation')

type ResumeConversationUseCaseDependencies = {
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly messageRepository: MessageRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
  readonly conversationEngine: ConversationEngine
}

export class ResumeConversationUseCase {
  constructor(private readonly dependencies: ResumeConversationUseCaseDependencies) {}

  async execute(params: ResumeConversationParams): Promise<ResumeConversationResult> {
    const session = await this.dependencies.conversationSessionRepository.findById(params.sessionId)
    if (!session) {
      resumeLog.warn(LOG_EVENTS.CONVERSATION_RESUME_SESSION_NOT_FOUND, { sessionId: params.sessionId })
      throw new NotFoundError(`Conversation session ${params.sessionId} not found`, CONVERSATION_NOT_FOUND)
    }

    if (!params.transcript) {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.AUDIO_NOT_SUPPORTED_YET)
      resumeLog.info(LOG_EVENTS.CONVERSATION_RESUME_PROCESSED, { sessionId: params.sessionId, transcribed: false })
      return { resumed: false }
    }

    const parsed: ParsedInboundMessage = {
      kind: 'text',
      from: session.customerPhone,
      waMessageId: generateId(),
      body: params.transcript,
    }

    await this.dependencies.messageRepository.create({
      id: generateId(),
      sessionId: session.id,
      direction: 'inbound',
      waMessageId: parsed.waMessageId,
      type: 'text',
      body: parsed.body,
    })

    await this.dependencies.conversationEngine.handle(parsed)

    resumeLog.info(LOG_EVENTS.CONVERSATION_RESUME_PROCESSED, { sessionId: params.sessionId, transcribed: true })
    return { resumed: true }
  }
}
