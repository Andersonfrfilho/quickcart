/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cadeia de dispatch da spec §4: carrega/cria a sessão, expira p/ `greeting` após
 * SESSION_EXPIRY_MS sem interação, roda o GlobalHandler (sair/cancelar/repeat_order,
 * qualquer estado) e só então o handler do estado atual. Estados sem handler
 * registrado (ainda não implementados nesta fase) caem no fallback — `cart_review`
 * tem mensagem própria porque marca o fim do que a Fase 4 entrega.
 */

import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { CustomerRepositoryInterface } from '@/modules/webhook/domain/CustomerRepository.interface'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'
import type {
  ConversationHandlerInterface,
  GlobalConversationHandlerInterface,
} from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import { CONVERSATION_STATE, SESSION_EXPIRY_MS, type ConversationState } from '@/modules/conversation/shared/ConversationState.constant'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { LOG_EVENTS } from '@/shared/constants/log-events.constant'
import { logger } from '@/shared/logger'

const engineLog = logger.child('conversation', 'engine')

export type ConversationEngineDependencies = {
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly customerRepository: CustomerRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
  readonly globalHandler: GlobalConversationHandlerInterface
  readonly handlers: Partial<Record<ConversationState, ConversationHandlerInterface>>
}

export class ConversationEngine {
  constructor(private readonly dependencies: ConversationEngineDependencies) {}

  async handle(message: ParsedInboundMessage): Promise<void> {
    const customer = await this.dependencies.customerRepository.findByPhone(message.from)
    if (!customer) {
      engineLog.warn(LOG_EVENTS.CONVERSATION_CUSTOMER_NOT_FOUND, { from: message.from })
      return
    }

    const session = await this.resolveSession(message.from)
    const context = { session, customer, message }

    const wasHandledGlobally = await this.dependencies.globalHandler.tryHandle(context)
    if (wasHandledGlobally) return

    const handler = this.dependencies.handlers[session.currentState as ConversationState]
    if (!handler) {
      await this.sendUnhandledStateFallback(session)
      return
    }

    await handler.handle(context)
  }

  private async resolveSession(phone: string): Promise<ConversationSession> {
    const session = await this.dependencies.conversationSessionRepository.findOrCreateByPhone(phone)
    const isExpired = Date.now() - session.lastInteractionAt.getTime() > SESSION_EXPIRY_MS
    if (!isExpired) return session

    return this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone: phone,
      currentState: CONVERSATION_STATE.GREETING,
      context: { wasExpired: true },
    })
  }

  private async sendUnhandledStateFallback(session: ConversationSession): Promise<void> {
    await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.FALLBACK_STATE_NOT_READY)
  }
}
