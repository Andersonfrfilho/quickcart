/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * `SSEProvider` do QuickCart. Os streams não aceitam header (EventSource não manda nenhum), então
 * a credencial deles é um ticket emitido antes por uma rota autenticada — e pegar o ticket é
 * assíncrono, enquanto o contrato do SDK devolve o stream de forma síncrona.
 *
 * A saída é um source que já aceita listeners e conecta em segundo plano: quem assina não espera,
 * e o `close()` antes de o ticket chegar cancela a conexão em vez de deixar um EventSource órfão.
 */

import type { ConversationEventSource, SSEProvider } from '@adatechnology/conversations-ui'
import { getAccessToken } from '@/modules/auth/shared/sessionStore'

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const ADMIN_BASE_PATH = '/v1/admin'

type PendingListener = {
  readonly type: string
  readonly listener: (event: MessageEvent) => void
}

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

function createDeferredEventSource(params: {
  readonly streamPath: (ticket: string) => string
  readonly conversationId?: string
}): ConversationEventSource {
  const pending: PendingListener[] = []
  let connected: EventSource | undefined
  let closed = false

  void issueTicket(params.conversationId)
    .then((ticket) => {
      if (closed) return

      const source = new EventSource(`${API_BASE_URL}${params.streamPath(ticket)}`)
      for (const entry of pending) source.addEventListener(entry.type, entry.listener)
      connected = source
    })
    .catch(() => {
      // Sem ticket não há stream. Silenciar aqui é deliberado: a UI já refaz a query no refetch
      // inicial, e derrubar a tela por falha de realtime seria pior que ficar sem tempo real.
    })

  return {
    addEventListener(type: string, listener: (event: MessageEvent) => void): void {
      if (connected) {
        connected.addEventListener(type, listener)
        return
      }
      pending.push({ type, listener })
    },

    removeEventListener(type: string, listener: (event: MessageEvent) => void): void {
      if (connected) {
        connected.removeEventListener(type, listener)
        return
      }
      const index = pending.findIndex((entry) => entry.type === type && entry.listener === listener)
      if (index >= 0) pending.splice(index, 1)
    },

    close(): void {
      closed = true
      connected?.close()
      pending.length = 0
    },
  }
}

export const conversationsSse: SSEProvider = {
  connectConversationStream(conversationId: string): ConversationEventSource {
    return createDeferredEventSource({
      conversationId,
      streamPath: (ticket) =>
        `${ADMIN_BASE_PATH}/conversations/${encodeURIComponent(conversationId)}/stream?ticket=${ticket}`,
    })
  },

  connectGlobalStream(): ConversationEventSource {
    return createDeferredEventSource({
      streamPath: (ticket) => `${ADMIN_BASE_PATH}/conversations/stream?ticket=${ticket}`,
    })
  },
}
