/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Adaptador sobre o MessageRepository do @adatechnology/meta-whatsapp-module. A gravação
 * agora é idempotente no banco (índice único parcial sobre companyId + waMessageId), e não
 * mais por um SELECT prévio — duas entregas concorrentes do mesmo webhook não duplicam.
 */

import { MessageRepository, type MessageRow } from '@adatechnology/meta-whatsapp-module'
import type { MessageStatus } from '@adatechnology/meta-whatsapp-contracts'
import { db } from '@/infra/database/connection'
import { environment } from '@/infra/config/environment'
import type { Message } from '@/modules/webhook/domain/Conversation.types'
import type {
  CreateMessageRecordParams,
  MessageRepositoryInterface,
} from '@/modules/webhook/domain/MessageRepository.interface'

const COMPANY_ID = environment.WHATSAPP_COMPANY_ID

function toDomain(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.sessionId,
    direction: row.direction,
    waMessageId: row.waMessageId,
    type: row.type,
    body: row.content,
    payload: row.payload,
    status: row.status,
    createdAt: row.createdAt,
  }
}

export class DrizzleMessageRepository implements MessageRepositoryInterface {
  constructor(private readonly messageRepository: MessageRepository = new MessageRepository(db)) {}

  async create(params: CreateMessageRecordParams): Promise<Message | undefined> {
    const row = await this.messageRepository.insertMessage({
      companyId: COMPANY_ID,
      sessionId: params.sessionId,
      whatsappNumber: params.customerPhone,
      direction: params.direction,
      // O QuickCart não tem atendimento humano: entrada é sempre o cliente, saída é sempre o bot.
      sender: params.direction === 'inbound' ? 'customer' : 'bot',
      type: params.type,
      content: params.body ?? null,
      payload: (params.payload as Record<string, unknown> | undefined) ?? null,
      waMessageId: params.waMessageId ?? null,
      status: (params.status as MessageStatus | undefined) ?? null,
    })

    return row ? toDomain(row) : undefined
  }

  async updateStatusByWaMessageId(waMessageId: string, status: string): Promise<Message | undefined> {
    const row = await this.messageRepository.updateMessageStatus(COMPANY_ID, waMessageId, status as MessageStatus)
    return row ? toDomain(row) : undefined
  }
}
