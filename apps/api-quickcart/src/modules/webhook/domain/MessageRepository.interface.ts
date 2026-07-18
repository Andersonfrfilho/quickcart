/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { Message } from '@/infra/database/schema'

export type CreateMessageRecordParams = {
  readonly id: string
  readonly sessionId: string
  readonly direction: 'inbound' | 'outbound'
  readonly waMessageId?: string | undefined
  readonly type: string
  readonly body?: string | undefined
  readonly payload?: unknown
  readonly status?: string | undefined
}

export interface MessageRepositoryInterface {
  create(params: CreateMessageRecordParams): Promise<Message>
  updateStatusByWaMessageId(waMessageId: string, status: string): Promise<Message | undefined>
}
