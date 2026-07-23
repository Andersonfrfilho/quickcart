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
  UpdateConversationSessionStateByPhoneParams,
} from '@/modules/webhook/domain/ConversationSessionRepository.interface'

export class DrizzleConversationSessionRepository implements ConversationSessionRepositoryInterface {
  async findById(id: string): Promise<ConversationSession | undefined> {
    const [session] = await db.select().from(conversationSessions).where(eq(conversationSessions.id, id)).limit(1)

    return session
  }

  async findByPhone(customerPhone: string): Promise<ConversationSession | undefined> {
    const [session] = await db
      .select()
      .from(conversationSessions)
      .where(eq(conversationSessions.customerPhone, customerPhone))
      .limit(1)

    return session
  }

  async findOrCreateByPhone(customerPhone: string): Promise<ConversationSession> {
    const existing = await this.findByPhone(customerPhone)
    if (existing) return existing

    const [created] = await db
      .insert(conversationSessions)
      .values({ id: generateId(), customerPhone })
      .onConflictDoNothing({ target: conversationSessions.customerPhone })
      .returning()

    if (created) return created as ConversationSession

    const fallback = await this.findByPhone(customerPhone)
    if (!fallback) throw new Error(`Failed to create conversation session for phone ${customerPhone}`)
    return fallback
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

  async updateStateByPhone(params: UpdateConversationSessionStateByPhoneParams): Promise<ConversationSession> {
    const [session] = await db
      .insert(conversationSessions)
      .values({
        id: generateId(),
        customerPhone: params.customerPhone,
        currentState: params.currentState,
        context: params.context,
      })
      .onConflictDoUpdate({
        target: conversationSessions.customerPhone,
        set: {
          currentState: params.currentState,
          context: params.context,
          lastInteractionAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning()

    return session as ConversationSession
  }
}
