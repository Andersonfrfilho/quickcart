/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { Customer } from '@/infra/database/schema'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'

export type ConversationHandlerContext = {
  readonly session: ConversationSession
  readonly customer: Customer
  readonly message: ParsedInboundMessage
}

export interface ConversationHandlerInterface {
  handle(context: ConversationHandlerContext): Promise<void>
}

export interface GlobalConversationHandlerInterface {
  /** Retorna `true` quando a mensagem foi consumida (interrompe a cadeia antes do handler do estado). */
  tryHandle(context: ConversationHandlerContext): Promise<boolean>
}
