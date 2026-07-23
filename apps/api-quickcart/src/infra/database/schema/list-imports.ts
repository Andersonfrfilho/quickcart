/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { pgTable, uuid, varchar, text, jsonb, integer, timestamp } from 'drizzle-orm/pg-core'
import { conversationSessions } from './conversation-sessions'

export const listImports = pgTable('list_imports', {
  id: uuid('id').primaryKey(),
  sessionId: uuid('session_id').references(() => conversationSessions.id, { onDelete: 'set null' }),
  source: varchar('source', { length: 10 }).notNull(),
  rawText: text('raw_text').notNull(),
  transcript: text('transcript'),
  parseResult: jsonb('parse_result').notNull(),
  matchedCount: integer('matched_count').default(0).notNull(),
  ambiguousCount: integer('ambiguous_count').default(0).notNull(),
  unmatchedCount: integer('unmatched_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type ListImport = typeof listImports.$inferSelect
export type NewListImport = typeof listImports.$inferInsert
