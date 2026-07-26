/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Adaptador sobre o SessionRepository do @adatechnology/meta-whatsapp-module. A interface
 * de domínio é preservada intacta para que os handlers de conversa (~2.000 linhas) não
 * saibam que a persistência mudou de tabela; a tradução de nomes (customerPhone ↔
 * whatsappNumber, lastInteractionAt ↔ lastActivity) e a amarração do tenant único ficam
 * confinadas aqui.
 */

import { and, eq } from 'drizzle-orm'
import { SessionRepository, sessions, type SessionRow } from '@adatechnology/meta-whatsapp-module'
import { db } from '@/infra/database/connection'
import { environment } from '@/infra/config/environment'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type {
  ConversationSessionRepositoryInterface,
  TouchConversationSessionByPhoneParams,
  UpdateConversationSessionStateByPhoneParams,
} from '@/modules/webhook/domain/ConversationSessionRepository.interface'

const COMPANY_ID = environment.WHATSAPP_COMPANY_ID

function toDomain(row: SessionRow): ConversationSession {
  return {
    id: row.id,
    customerPhone: row.whatsappNumber,
    currentState: row.currentState,
    context: row.context,
    mode: row.mode,
    lastInteractionAt: row.lastActivity,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class DrizzleConversationSessionRepository implements ConversationSessionRepositoryInterface {
  constructor(private readonly sessionRepository: SessionRepository = new SessionRepository(db)) {}

  // O módulo indexa por (companyId, whatsappNumber); o id só é consultado no retorno do STT,
  // que carrega o sessionId do job. Por isso esta é a única leitura que desce direto à tabela.
  async findById(id: string): Promise<ConversationSession | undefined> {
    const [row] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.companyId, COMPANY_ID), eq(sessions.id, id)))
      .limit(1)

    return row ? toDomain(row) : undefined
  }

  async findByPhone(customerPhone: string): Promise<ConversationSession | undefined> {
    const row = await this.sessionRepository.getContext(COMPANY_ID, customerPhone)
    return row ? toDomain(row) : undefined
  }

  async findOrCreateByPhone(customerPhone: string): Promise<ConversationSession> {
    const row = await this.sessionRepository.getOrCreate(COMPANY_ID, customerPhone, CONVERSATION_STATE.GREETING)
    return toDomain(row)
  }

  async touchByPhone(params: TouchConversationSessionByPhoneParams): Promise<ConversationSession> {
    const row = await this.sessionRepository.getOrCreate(
      COMPANY_ID,
      params.customerPhone,
      CONVERSATION_STATE.GREETING,
    )
    // touchInbound carimba lastInboundAt além de lastActivity — é ele que sustenta a janela de
    // 24h da Meta. O upsert acima já move lastActivity, mas não distingue quem falou.
    await this.sessionRepository.touchInbound(COMPANY_ID, params.customerPhone)

    return toDomain({ ...row, lastActivity: new Date(), lastInboundAt: new Date() })
  }

  async updateStateByPhone(params: UpdateConversationSessionStateByPhoneParams): Promise<ConversationSession> {
    const existing = await this.sessionRepository.getOrCreate(
      COMPANY_ID,
      params.customerPhone,
      CONVERSATION_STATE.GREETING,
    )
    await this.sessionRepository.setState(COMPANY_ID, params.customerPhone, params.currentState, params.context)

    return toDomain({
      ...existing,
      currentState: params.currentState,
      context: params.context,
      lastActivity: new Date(),
    })
  }
}
