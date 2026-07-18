/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { eq } from 'drizzle-orm'
import { db } from '@/infra/database/connection'
import { messages, type Message } from '@/infra/database/schema'
import type {
  CreateMessageRecordParams,
  MessageRepositoryInterface,
} from '@/modules/webhook/domain/MessageRepository.interface'

export class DrizzleMessageRepository implements MessageRepositoryInterface {
  async create(params: CreateMessageRecordParams): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values({
        id: params.id,
        sessionId: params.sessionId,
        direction: params.direction,
        waMessageId: params.waMessageId ?? null,
        type: params.type,
        body: params.body ?? null,
        payload: params.payload ?? null,
        status: params.status ?? null,
      })
      .returning()

    return message as Message
  }

  async updateStatusByWaMessageId(waMessageId: string, status: string): Promise<Message | undefined> {
    const [message] = await db
      .update(messages)
      .set({ status, updatedAt: new Date() })
      .where(eq(messages.waMessageId, waMessageId))
      .returning()

    return message
  }
}
