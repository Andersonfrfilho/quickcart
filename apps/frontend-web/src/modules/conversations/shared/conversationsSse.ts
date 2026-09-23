/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * `SSEProvider` do QuickCart. A mecânica de ticket/stream saiu para `shared/sse` quando a tela de
 * separação passou a precisar da mesma coisa — aqui fica só o que é da inbox: as rotas.
 */

import type { ConversationEventSource, SSEProvider } from '@adatechnology/conversations-ui'
import { createDeferredEventSource } from '@/shared/sse/deferredEventSource'
import { getAccessToken } from '@/modules/auth/shared/sessionStore'

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const ADMIN_BASE_PATH = '/v1/admin'

async function issueTicket(conversationId?: string): Promise<string> {
  const query = conversationId ? `?conversation=${encodeURIComponent(conversationId)}` : ''
  const response = await fetch(`${API_BASE_URL}${ADMIN_BASE_PATH}/conversations/stream-ticket${query}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
  })

  if (!response.ok) throw new Error(`Não foi possível abrir o stream (${response.status}).`)

  const body = (await response.json()) as { data: { ticket: string } }
  return body.data.ticket
}

export const conversationsSse: SSEProvider = {
  connectConversationStream(conversationId: string): ConversationEventSource {
    return createDeferredEventSource({
      issueTicket: () => issueTicket(conversationId),
      streamUrl: (ticket) =>
        `${API_BASE_URL}${ADMIN_BASE_PATH}/conversations/${encodeURIComponent(conversationId)}/stream?ticket=${ticket}`,
    })
  },

  connectGlobalStream(): ConversationEventSource {
    return createDeferredEventSource({
      issueTicket: () => issueTicket(),
      streamUrl: (ticket) => `${API_BASE_URL}${ADMIN_BASE_PATH}/conversations/stream?ticket=${ticket}`,
    })
  },
}
