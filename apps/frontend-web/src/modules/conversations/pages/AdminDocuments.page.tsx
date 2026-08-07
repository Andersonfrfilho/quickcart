/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Biblioteca de arquivos de todas as conversas. Usa o `DocumentsWorkspace` do SDK — a tela é do
 * pacote, não daqui; esta página só injeta o `ConversationsApi` e o filtro de conversa que o
 * upload manual exige.
 *
 * `DocumentsWorkspace` (não `DocumentsLibrary`) porque `uploadDocument` aqui precisa saber a que
 * conversa o arquivo pertence — `documentRepository.link` no backend exige um `sessionId`, e
 * `renderFilters` é o único jeito do host colocar esse número na tela sem o pacote conhecer o
 * vocabulário do WhatsApp.
 */

import { useState } from 'react'
import '@adatechnology/conversations-ui/styles.css'
import { ConversationsProvider, DocumentsWorkspace } from '@adatechnology/conversations-ui'
import { useRouter } from '@/app/router'
import { conversationsApi } from '@/modules/conversations/shared/conversationsApi'
import { conversationsSse } from '@/modules/conversations/shared/conversationsSse'

export function AdminDocumentsPage() {
  const { navigate } = useRouter()
  const [whatsappNumber, setWhatsappNumber] = useState('')

  return (
    <ConversationsProvider api={conversationsApi} sse={conversationsSse}>
      <div className="p-4 lg:p-6">
        <DocumentsWorkspace
          // Leva para a inbox com a conversa aberta: encontrar o arquivo raramente é o fim do
          // trabalho — o atendente quer o contexto em que ele apareceu.
          onOpenConversation={(conversationId) => navigate(`/admin/conversations?number=${conversationId}`)}
          renderFilters={({ setExtra }) => (
            <input
              type="text"
              value={whatsappNumber}
              placeholder="WhatsApp do cliente para enviar arquivo"
              onChange={(event) => {
                const value = event.target.value
                setWhatsappNumber(value)
                setExtra(value ? { whatsappNumber: value } : {})
              }}
              className="h-8 rounded-md border border-neutral-300 px-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
          )}
        />
      </div>
    </ConversationsProvider>
  )
}
