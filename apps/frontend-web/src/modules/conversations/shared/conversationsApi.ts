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

import type { ConversationsApi, ConversationSummary, MessagePayload, SSEProvider } from '@adatechnology/conversations-ui'
import { getAdminToken } from '@/modules/admin/shared/useAdminAuth.hook'
import { ApiRequestError } from '@/modules/conversations/shared/ApiRequestError'

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const ADMIN_BASE_PATH = '/v1/admin'

function adminToken(): string {
  // sessionStorage, pelo mesmo acessor do login — ler localStorage aqui mandava token vazio.
  return getAdminToken() ?? ''
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
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; code?: string } }
      | null
    throw new ApiRequestError(
      body?.error?.message ?? `Falha na requisição (${response.status})`,
      response.status,
      body?.error?.code,
    )
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

// A API fala `sentAt`/`received` e tipos como `interactive_list`; o SDK espera `timestamp` e uma
// união fechada de tipos. Sem traduzir aqui, o horário vira "NaN:NaN" na bolha e o tipo cai fora
// do contrato — o adapter é justamente o lugar de absorver essa diferença.
export type ApiMessage = {
  readonly id: string
  readonly type: string
  readonly content?: string
  readonly direction: MessagePayload['direction']
  readonly sender: MessagePayload['sender']
  readonly status?: string
  readonly sentAt: string
  readonly readAt?: string | null
  readonly uploadId?: string
  readonly sizeBytes?: number
  readonly mediaId?: string
  readonly mimeType?: string
  readonly filename?: string
  readonly moderation?: NonNullable<MessagePayload['moderation']> | null
}

const RENDERABLE_MESSAGE_TYPES = new Set<MessagePayload['type']>([
  'text',
  'image',
  'video',
  'audio',
  'document',
  'sticker',
  'template',
])

const DELIVERY_STATUSES = new Set<NonNullable<MessagePayload['status']>>(['sent', 'delivered', 'read', 'failed'])

export function toMessagePayload(message: ApiMessage): MessagePayload {
  const type = message.type as MessagePayload['type']
  const status = message.status as NonNullable<MessagePayload['status']>

  return {
    id: message.id,
    // Interativos (`interactive_list`, `button`) não têm renderização própria no SDK; o que o
    // cliente viu foi o texto, então é como texto que eles devem aparecer no transcript.
    type: RENDERABLE_MESSAGE_TYPES.has(type) ? type : 'text',
    // `exactOptionalPropertyTypes` distingue ausente de undefined: as opcionais entram por spread
    // condicional, nunca com valor undefined explícito.
    ...(message.content !== undefined ? { content: message.content } : {}),
    direction: message.direction,
    sender: message.sender,
    timestamp: message.sentAt,
    // `received` é estado de entrada e não tem tique de entrega — virar `undefined` é o que
    // impede a bolha de inbound desenhar confirmação que não existe.
    ...(DELIVERY_STATUSES.has(status) ? { status } : {}),
    ...(message.readAt ? { readAt: message.readAt } : {}),
    // `uploadId` primeiro na cadeia do MediaRenderer: mídia já copiada para o nosso storage sai por
    // URL assinada, sem passar pela Meta.
    ...(message.uploadId ? { uploadId: message.uploadId } : {}),
    ...(message.mediaId ? { mediaId: message.mediaId } : {}),
    ...(message.mimeType ? { mimeType: message.mimeType } : {}),
    ...(message.filename ? { filename: message.filename } : {}),
    ...(message.sizeBytes ? { sizeBytes: message.sizeBytes } : {}),
    // `null` (não avaliado) é distinto de avaliado-e-limpo e passa adiante; só a chave ausente cai.
    ...(message.moderation !== undefined ? { moderation: message.moderation } : {}),
  }
}

export const conversationsApi: ConversationsApi = {
  fetchConversations: async (params) => {
    const conversations = await request<readonly ConversationSummary[]>(
      `/conversations${buildQuery({
        page: params?.page,
        limit: params?.limit,
        waitingHuman: params?.waitingHuman,
        search: params?.search,
      })}`,
    )

    // A listagem devolve `id` como UUID da sessão, mas todas as outras rotas — mensagens, stream,
    // takeover — endereçam a conversa pelo número. Sem reescrever aqui, clicar numa conversa pede
    // as mensagens de um id que a API não conhece e volta 500.
    return conversations.map((conversation) => ({ ...conversation, id: conversation.whatsappNumber }))
  },

  fetchMessages: async (conversationId, params) => {
    const messages = await request<readonly ApiMessage[]>(
      `/conversations/${encodeURIComponent(conversationId)}/messages${buildQuery({
        limit: params?.limit,
        before: params?.before,
      })}`,
    )

    return messages.map(toMessagePayload)
  },

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

  // Repassa filtro, ordenação e página: o backend honra os quatro, e mandar só `search` faria a UI
  // exibir controles que não mudam nada.
  getDocuments: (conversationId, params) =>
    request(
      `/conversations/${encodeURIComponent(conversationId)}/documents${buildQuery({
        search: params?.search,
        source: params?.source,
        sortDirection: params?.sortDirection,
        page: params?.page,
        limit: params?.limit,
      })}`,
    ),

  // Biblioteca da empresa: mesma forma de filtro do painel da conversa, mas sem conversa no
  // caminho — cada item volta dizendo de qual conversa veio.
  getAllDocuments: (params) =>
    request(
      `/documents${buildQuery({
        search: params?.search,
        source: params?.source,
        sortDirection: params?.sortDirection,
        page: params?.page,
        limit: params?.limit,
      })}`,
    ),

  // Resposta binária, então não passa pelo `request` (que desembrulha JSON `{ data }`).
  downloadDocumentsArchive: async (conversationId, uploadIds) => {
    const response = await fetch(
      `${API_BASE_URL}${ADMIN_BASE_PATH}/conversations/${encodeURIComponent(conversationId)}/documents/archive`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken()}` },
        body: JSON.stringify({ uploadIds }),
      },
    )

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
      throw new Error(body?.error?.message ?? `Falha ao montar o arquivo (${response.status})`)
    }

    return response.blob()
  },

  // A rota devolve URL assinada e curta; o binário nunca passa pela API — o atendente vai direto
  // ao storage. Por isso o `uploadId` (que é a key do objeto) precisa ser escapado.
  getDocumentUrl: async (uploadId, disposition) => {
    const { url } = await request<{ url: string }>(
      `/documents/${encodeURIComponent(uploadId)}/url${buildQuery({ disposition })}`,
    )
    return url
  },
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
