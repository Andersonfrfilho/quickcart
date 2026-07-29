/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Lado do cliente do fluxo, para exercitar o bot sem telefone real. O cliente do pacote monta o
 * payload da Meta e assina com HMAC, entregando no nosso webhook de verdade — mesma validação de
 * staging e produção, sem rota alternativa. Se o fluxo responde aqui, responde para a Meta.
 *
 * Mora DENTRO da tela de Conversas, e não numa aba própria, por um motivo prático: o token de admin
 * fica em `sessionStorage`, que é por aba. Numa aba separada o simulador nascia sem sessão, o
 * transcript nunca carregava e o sintoma era "mandei e não aconteceu nada". Aqui ele herda a sessão
 * da tela que já está aberta, e o efeito de cada envio aparece na thread ao lado pelo mesmo SSE que a
 * inbox já assina — este painel não abre conexão própria.
 */

import { useMemo } from 'react'
import { X } from 'lucide-react'
import { ConversationPreview, createPreviewWebhookClient } from '@adatechnology/conversations-ui/preview'

import { conversationsApi } from '@/modules/conversations/shared/conversationsApi'
import { conversationsSse } from '@/modules/conversations/shared/conversationsSse'
import { readPreviewEnvironment } from '@/modules/preview/shared/previewEnvironment'

type ConversationSimulatorPanelProps = {
  conversationId: string
  onClose: () => void
}

export function ConversationSimulatorPanel({ conversationId, onClose }: ConversationSimulatorPanelProps) {
  const environment = useMemo(() => readPreviewEnvironment(), [])
  const client = useMemo(
    () =>
      createPreviewWebhookClient({
        webhookUrl: environment.webhookUrl,
        appSecret: environment.appSecret,
        // Assina como a conversa ABERTA, não como um número fixo de fixture: o que se quer testar é
        // o fluxo deste cliente, com o contexto e o estado que ele já tem.
        from: conversationId,
      }),
    [environment, conversationId],
  )

  return (
    <aside className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-gray-900">
      <header className="flex items-center justify-between border-b px-4 py-3 dark:border-gray-800">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">Simulador do cliente</h2>
          <p className="truncate text-xs text-gray-400">{conversationId} · entrega no webhook real</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Fechar simulador"
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
        >
          <X size={18} />
        </button>
      </header>

      <div className="min-h-0 flex-1">
        <ConversationPreview
          client={client}
          sse={conversationsSse}
          conversationId={conversationId}
          loadMessages={(id) => conversationsApi.fetchMessages(id)}
          placeholder="Escreva como o cliente…"
        />
      </div>
    </aside>
  )
}
