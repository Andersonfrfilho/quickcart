/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Inbox de atendimento. A tela inteira vem do `ConversationsWorkspace` do SDK — grade, filtros,
 * paginação, seleção em massa e conversa são a mesma coisa nos três produtos, e enquanto cada um
 * montava a própria cópia elas divergiam sem que nenhuma revisão percebesse. O que é do QuickCart
 * entra pelos slots: vocabulário do contexto, respostas prontas, exportação e simulador.
 */

import { useMemo } from 'react'
import '@adatechnology/conversations-ui/styles.css'
import { ConversationsProvider, ConversationsWorkspace } from '@adatechnology/conversations-ui'

import { useRouter } from '@/app/router'
import { ConversationSimulatorPanel } from '@/modules/conversations/components/ConversationSimulatorPanel'
import { CONVERSATION_QUICK_REPLIES, quickReplyVariablesFor } from '@/modules/conversations/shared/quickReplies'
import { IS_PREVIEW_ENABLED } from '@/modules/preview/shared/previewEnvironment'
import { conversationsApi } from '@/modules/conversations/shared/conversationsApi'
import { conversationsSse } from '@/modules/conversations/shared/conversationsSse'
import { useTranscriptionActive } from '@/modules/conversations/hooks/useTranscriptionActive.hook'
import { toContextEntries } from '@/modules/conversations/shared/conversationContext'
import { downloadConversation } from '@/modules/conversations/shared/conversationsExport'
import { fileToAttachment } from '@/modules/conversations/shared/fileToAttachment'

function Inbox() {
  const { searchParams } = useRouter()
  // Lido uma vez: o workspace usa como conversa inicial, e reagir a mudanças depois roubaria a
  // conversa que o atendente tivesse aberto na mão.
  const linkedConversationId = searchParams.get('number') ?? undefined

  return (
    <ConversationsWorkspace
      className="h-full"
      signInHref="#/admin"
      {...(linkedConversationId ? { initialConversationId: linkedConversationId } : {})}
      contextEntriesOf={toContextEntries}
      quickReplies={CONVERSATION_QUICK_REPLIES}
      quickReplyVariablesFor={(conversation) => quickReplyVariablesFor(conversation.clientName)}
      onDownload={(conversation) =>
        void downloadConversation({
          conversationId: conversation.id,
          ...(conversation.clientName ? { clientName: conversation.clientName } : {}),
        })
      }
      onAttach={async (conversation, file) => {
        await conversationsApi.sendMedia(conversation.id, await fileToAttachment(file))
      }}
      simulator={{
        // Só em dev e com a flag ligada: o simulador assina o webhook com o app secret, que não
        // existe fora do ambiente local.
        enabled: IS_PREVIEW_ENABLED,
        label: 'Simular cliente (dev)',
        render: ({ conversationId, close }) => (
          <ConversationSimulatorPanel conversationId={conversationId} onClose={close} />
        ),
      }}
    />
  )
}

export function AdminConversationsPage() {
  const isTranscriptionActive = useTranscriptionActive()

  /**
   * Omite `transcribeAudio` quando a transcrição não está valendo para esta empresa.
   *
   * O contrato do SDK trata o método como opcional POR CAPACIDADE, e é a ausência que faz o balão não
   * desenhar o botão. Entregar sempre a implementação — que existe no cliente independentemente da
   * configuração do servidor — colocaria um "Transcrever" em instalações sem engine, e o clique
   * voltaria 404.
   */
  const api = useMemo(() => {
    if (isTranscriptionActive) return conversationsApi
    const { transcribeAudio: _omitido, ...withoutTranscription } = conversationsApi
    return withoutTranscription
  }, [isTranscriptionActive])

  return (
    <ConversationsProvider api={api} sse={conversationsSse}>
      <Inbox />
    </ConversationsProvider>
  )
}
