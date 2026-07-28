/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Biblioteca de arquivos de todas as conversas. Usa o `DocumentsLibrary` do SDK — a tela é do
 * pacote, não daqui; esta página só injeta o `ConversationsApi` e diz como navegar para a conversa
 * de origem.
 */

import '@adatechnology/conversations-ui/styles.css'
import { ConversationsProvider, DocumentsLibrary } from '@adatechnology/conversations-ui'
import { useRouter } from '@/app/router'
import { conversationsApi } from '@/modules/conversations/shared/conversationsApi'
import { conversationsSse } from '@/modules/conversations/shared/conversationsSse'

export function AdminDocumentsPage() {
  const { navigate } = useRouter()

  return (
    <ConversationsProvider api={conversationsApi} sse={conversationsSse}>
      <div className="p-4 lg:p-0">
        <DocumentsLibrary
          // Leva para a inbox com a conversa aberta: encontrar o arquivo raramente é o fim do
          // trabalho — o atendente quer o contexto em que ele apareceu.
          onOpenConversation={(conversationId) => navigate(`/admin/conversations?number=${conversationId}`)}
        />
      </div>
    </ConversationsProvider>
  )
}
