/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Implementação do ConversationsApi que o @adatechnology/conversations-ui exige. O SDK é
 * headless: ele não sabe de onde vêm os dados, só consome este contrato — o que permite as
 * telas dele funcionarem aqui sem que o pacote conheça as rotas do QuickCart.
 *
 * O identificador de conversa é o número de WhatsApp, igual ao backend.
 */

import type { ConversationsApi, SSEProvider } from '@adatechnology/conversations-ui'
import { ADMIN_TOKEN_STORAGE_KEY } from '@/modules/admin/shared/adminAuth.constant'

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const ADMIN_BASE_PATH = '/v1/admin'

function adminToken(): string {
  return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? ''
}

async function request<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${ADMIN_BASE_PATH}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken()}`,
      ...init?.headers,
    },
  })

  if (!response.ok) {
    // A API responde { error: { code, message } }; preservar a mensagem é o que faz o toast do
    // SDK dizer algo útil em vez de "erro inesperado".
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? `Falha na requisição (${response.status})`)
  }

  if (response.status === 204) return undefined as TResponse
  const body = (await response.json()) as { data: TResponse }
  return body.data
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const conversationsApi: ConversationsApi = {
  fetchConversations: (params) =>
    request(
      `/conversations${buildQuery({
        page: params?.page,
        limit: params?.limit,
        waitingHuman: params?.waitingHuman,
        search: params?.search,
      })}`,
    ),

  fetchMessages: (conversationId, params) =>
    request(
      `/conversations/${encodeURIComponent(conversationId)}/messages${buildQuery({
        limit: params?.limit,
        before: params?.before,
      })}`,
    ),

  sendMessage: (conversationId, text) =>
    request(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  sendMedia: (conversationId, data) =>
    request(`/conversations/${encodeURIComponent(conversationId)}/media`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  sendTemplate: (conversationId, data) =>
    request(`/conversations/${encodeURIComponent(conversationId)}/template`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  markRead: (conversationId) =>
    request(`/conversations/${encodeURIComponent(conversationId)}/read`, { method: 'POST' }),

  getContext: (conversationId) => request(`/conversations/${encodeURIComponent(conversationId)}/context`),

  // Mídia é buscada da Meta sob demanda pelo backend — não há storage próprio, então o binário
  // chega em base64 no momento em que o atendente abre o anexo.
  getMediaProxyUrl: (mediaId) => request(`/whatsapp/media/${encodeURIComponent(mediaId)}`),

  // Biblioteca de documentos exige persistência de arquivo, que o QuickCart não tem. Devolver
  // vazio é honesto: a aba aparece sem itens, em vez de quebrar ou fingir que buscou.
  getDocuments: () => Promise.resolve([]),
  getDocumentUrl: () => Promise.reject(new Error('Biblioteca de documentos indisponível nesta instalação')),
}

// EventSource não manda header, então o backend troca token de admin por um ticket de uso único
// e curta duração, gasto na query. Cada abertura pede o seu.
async function openStream(path: string, conversation?: string): Promise<EventSource> {
  const { ticket } = await request<{ ticket: string }>(
    `/conversations/stream-ticket${buildQuery({ conversation })}`,
    { method: 'POST' },
  )
  return new EventSource(`${API_BASE_URL}${ADMIN_BASE_PATH}${path}${buildQuery({ ticket })}`)
}

// O SDK espera um EventSource síncrono, mas o ticket exige uma ida ao servidor antes. Este
// proxy devolve um EventSource real que só conecta quando o ticket chega, repassando os
// listeners registrados enquanto isso.
function deferredEventSource(open: () => Promise<EventSource>): EventSource {
  const listeners: { type: string; listener: EventListenerOrEventListenerObject }[] = []
  let real: EventSource | undefined
  let closed = false

  void open().then((source) => {
    if (closed) {
      source.close()
      return
    }
    real = source
    for (const { type, listener } of listeners) source.addEventListener(type, listener)
  })

  return {
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.push({ type, listener })
      real?.addEventListener(type, listener)
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      real?.removeEventListener(type, listener)
    },
    close: () => {
      closed = true
      real?.close()
    },
  } as EventSource
}

export const conversationsSse: SSEProvider = {
  connectGlobalStream: () => deferredEventSource(() => openStream('/conversations/stream')),
  connectConversationStream: (conversationId) =>
    deferredEventSource(() =>
      openStream(`/conversations/${encodeURIComponent(conversationId)}/stream`, conversationId),
    ),
}
