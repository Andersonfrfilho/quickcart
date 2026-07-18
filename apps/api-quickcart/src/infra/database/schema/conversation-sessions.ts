/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core'

export const conversationSessions = pgTable('conversation_sessions', {
  id: uuid('id').primaryKey(),
  customerPhone: varchar('customer_phone', { length: 20 }).notNull().unique(),
  currentState: varchar('current_state', { length: 40 }).default('greeting').notNull(),
  context: jsonb('context').default({}).notNull(),
  mode: varchar('mode', { length: 10 }).default('bot').notNull(),
  lastInteractionAt: timestamp('last_interaction_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type ConversationSession = typeof conversationSessions.$inferSelect
export type NewConversationSession = typeof conversationSessions.$inferInsert
