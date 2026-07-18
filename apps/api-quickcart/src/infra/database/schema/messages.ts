/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { pgTable, uuid, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { conversationSessions } from './conversation-sessions'

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => conversationSessions.id, { onDelete: 'cascade' }),
  direction: varchar('direction', { length: 10 }).notNull(),
  waMessageId: varchar('wa_message_id', { length: 80 }),
  type: varchar('type', { length: 20 }).notNull(),
  body: text('body'),
  payload: jsonb('payload'),
  status: varchar('status', { length: 16 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
