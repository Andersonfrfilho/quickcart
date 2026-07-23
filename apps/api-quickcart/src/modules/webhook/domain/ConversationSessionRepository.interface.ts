/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * findOrCreateByPhone existe separado de touchByPhone porque o ConversationEngine
 * precisa ler `lastInteractionAt` intocado para checar expiração de sessão (spec §4) —
 * se o lookup já atualizasse o timestamp como efeito colateral, nenhuma sessão jamais
 * pareceria expirada.
 */

import type { ConversationSession } from '@/infra/database/schema'

export type TouchConversationSessionByPhoneParams = {
  readonly customerPhone: string
}

export type UpdateConversationSessionStateByPhoneParams = {
  readonly customerPhone: string
  readonly currentState: string
  readonly context: Record<string, unknown>
}

export interface ConversationSessionRepositoryInterface {
  findById(id: string): Promise<ConversationSession | undefined>
  findByPhone(customerPhone: string): Promise<ConversationSession | undefined>
  findOrCreateByPhone(customerPhone: string): Promise<ConversationSession>
  touchByPhone(params: TouchConversationSessionByPhoneParams): Promise<ConversationSession>
  updateStateByPhone(params: UpdateConversationSessionStateByPhoneParams): Promise<ConversationSession>
}
