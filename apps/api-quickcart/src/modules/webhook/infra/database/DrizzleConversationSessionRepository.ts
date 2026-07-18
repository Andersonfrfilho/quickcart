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
import { conversationSessions, type ConversationSession } from '@/infra/database/schema'
import { generateId } from '@/shared/id'
import type {
  ConversationSessionRepositoryInterface,
  TouchConversationSessionByPhoneParams,
} from '@/modules/webhook/domain/ConversationSessionRepository.interface'

export class DrizzleConversationSessionRepository implements ConversationSessionRepositoryInterface {
  async findByPhone(customerPhone: string): Promise<ConversationSession | undefined> {
    const [session] = await db
      .select()
      .from(conversationSessions)
      .where(eq(conversationSessions.customerPhone, customerPhone))
      .limit(1)

    return session
  }

  async touchByPhone(params: TouchConversationSessionByPhoneParams): Promise<ConversationSession> {
    const [session] = await db
      .insert(conversationSessions)
      .values({ id: generateId(), customerPhone: params.customerPhone })
      .onConflictDoUpdate({
        target: conversationSessions.customerPhone,
        set: { lastInteractionAt: new Date(), updatedAt: new Date() },
      })
      .returning()

    return session as ConversationSession
  }
}
