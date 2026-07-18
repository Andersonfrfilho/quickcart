/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Erros do motor de conversa (usados a partir da Fase 4).
 */

import { DomainError } from '@/shared/errors/DomainError'
import { CONVERSATION_NOT_FOUND, CONVERSATION_INVALID_STATE } from '@/shared/errors/codes'

const CONVERSATION_DOMAIN = 'conversation'

export class ConversationError extends DomainError {
  constructor(message: string, statusCode: number, code: string, details?: Record<string, unknown>) {
    super(message, statusCode, code, CONVERSATION_DOMAIN, details)
    this.name = 'ConversationError'
  }
}

export class ConversationNotFoundError extends ConversationError {
  constructor(customerPhone: string) {
    super(`Sessão de conversa para "${customerPhone}" não encontrada.`, 404, CONVERSATION_NOT_FOUND, { customerPhone })
  }
}

export class ConversationInvalidStateError extends ConversationError {
  constructor(currentState: string, expectedStates: readonly string[]) {
    super(
      `Estado de conversa "${currentState}" inválido para esta ação.`,
      409,
      CONVERSATION_INVALID_STATE,
      { currentState, expectedStates },
    )
  }
}
