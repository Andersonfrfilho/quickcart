/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Preview do atendimento humano, alimentado por mocks: roda com a API desligada, sem banco e sem
 * Meta. Como o SDK é headless e recebe `{ api, sse }` por injeção, isto é apenas outra
 * implementação do mesmo contrato — nenhum componente sabe que os dados são falsos.
 */

import { useEffect, useMemo, useState } from 'react'
// Sem a folha do SDK, os componentes dele renderizam sem as cores próprias (iniciais do avatar e
// contador de não lidas somem no branco). O host precisa importá-la explicitamente.
import '@adatechnology/conversations-ui/styles.css'
import {
  ConversationDocumentsPanel,
  ConversationListItem,
  ConversationsProvider,
  MessageBubble,
  MessageComposer,
  useConversationList,
  useConversationMessages,
  useConversationRealtime,
} from '@adatechnology/conversations-ui'
import {
  createMockConversationsApi,
  createMockSSEProvider,
  createPreviewStore,
  PREVIEW_CONVERSATIONS,
  PREVIEW_MESSAGES,
  startPreviewScript,
} from '@adatechnology/conversations-ui/preview'

function ConversationPane({ conversationId }: { conversationId: string }) {
  const { messages, refetch } = useConversationMessages(conversationId)
  // Aberto por padrão: o preview existe para inspecionar componente, e painel fechado esconderia
  // justamente o que se quer olhar aqui.
  const [documentsOpen, setDocumentsOpen] = useState(true)

  // O evento do servidor é ping sem conteúdo (`{ direction, sender }`), então a chegada dispara
  // refetch. Renderizar a partir do evento funcionaria no mock e quebraria em produção.
  useConversationRealtime(conversationId, () => {
    void refetch()
  })

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <button
          type="button"
          onClick={() => setDocumentsOpen(!documentsOpen)}
          aria-expanded={documentsOpen}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          📄 Arquivos da conversa
        </button>
      </div>
      {/* perPage baixo de propósito: com os fixtures atuais é o que faz a barra de paginação
          aparecer no preview, senão esse estado nunca seria visto. */}
      <ConversationDocumentsPanel conversationId={conversationId} open={documentsOpen} perPage={3} />

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isMine={message.direction === 'outbound'}
            isFirstInGroup={message.isFirstInGroup ?? true}
          />
        ))}
      </div>
      <MessageComposer onSend={() => undefined} placeholder="Responder como atendente…" />
    </div>
  )
}

function Inbox() {
  const { conversations, refetch } = useConversationList()
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)

  // Recarrega a lista quando o roteiro mexe em qualquer conversa — é o papel do canal global.
  useEffect(() => {
    const timer = setInterval(() => void refetch(), 2000)
    return () => clearInterval(timer)
  }, [refetch])

  return (
    <div className="grid h-screen grid-cols-[320px_1fr]">
      <aside className="overflow-y-auto border-r">
        {conversations.map((conversation) => (
          <ConversationListItem
            key={conversation.id}
            conversation={conversation}
            active={conversation.id === selectedId}
            onClick={() => setSelectedId(conversation.id)}
          />
        ))}
      </aside>

      <main>
        {selectedId ? (
          <ConversationPane conversationId={selectedId} />
        ) : (
          <p className="p-6 text-sm text-gray-500">Selecione uma conversa.</p>
        )}
      </main>
    </div>
  )
}

export function AgentPreviewPage() {
  const store = useMemo(
    () => createPreviewStore({ conversations: PREVIEW_CONVERSATIONS, messages: PREVIEW_MESSAGES }),
    [],
  )
  const api = useMemo(() => createMockConversationsApi({ store }), [store])
  const sse = useMemo(() => createMockSSEProvider({ store }), [store])

  useEffect(() => startPreviewScript({ store }), [store])

  return (
    <ConversationsProvider api={api} sse={sse}>
      <Inbox />
    </ConversationsProvider>
  )
}
