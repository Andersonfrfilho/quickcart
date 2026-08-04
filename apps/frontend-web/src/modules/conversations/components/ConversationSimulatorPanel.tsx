/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Lado do cliente do fluxo, para exercitar o bot sem telefone real. O painel é o do pacote — aqui
 * ficam apenas as ligações com o host: cliente HTTP com sessão, SSE e leitura do transcript.
 *
 * O navegador manda a INTENÇÃO ("texto tal, deste número") e quem assina é a API. A versão anterior
 * assinava aqui, o que exigia `VITE_PREVIEW_APP_SECRET` — e `VITE_*` é literal inlinado no bundle:
 * o app secret da Meta ia junto com o JavaScript para qualquer um que baixasse a página.
 *
 * Mora DENTRO da tela de Conversas, e não numa aba própria, por um motivo prático: o token de admin
 * fica em `sessionStorage`, que é por aba. Numa aba separada o simulador nascia sem sessão, o
 * transcript nunca carregava e o sintoma era "mandei e não aconteceu nada". Aqui ele herda a sessão
 * da tela que já está aberta, e o efeito de cada envio aparece na thread ao lado pelo mesmo SSE que a
 * inbox já assina — este painel não abre conexão própria.
 *
 * Sem `uploadMedia`: a rota de upload do preview se autentica por HMAC, para a aba do cliente que não
 * tem sessão. Daqui, sem segredo no navegador, não há como assiná-la — então o gravador não é
 * desenhado, e a simulação neste painel é de texto e resposta interativa.
 */

import { useMemo } from 'react'
import { ConversationSimulatorPanel as SimulatorPanel, createPreviewBridgeClient } from '@adatechnology/conversations-ui/preview'

import { conversationsApi, sendPreviewInbound } from '@/modules/conversations/shared/conversationsApi'
import { conversationsSse } from '@/modules/conversations/shared/conversationsSse'

type ConversationSimulatorPanelProps = {
  conversationId: string
  onClose: () => void
}

export function ConversationSimulatorPanel({ conversationId, onClose }: ConversationSimulatorPanelProps) {
  const client = useMemo(
    () =>
      createPreviewBridgeClient({
        // Assina como a conversa ABERTA, não como um número fixo de fixture: o que se quer testar é
        // o fluxo deste cliente, com o contexto e o estado que ele já tem.
        from: conversationId,
        // `sendCommand` e não `endpointUrl`: o helper do módulo já carrega o token de admin.
        sendCommand: sendPreviewInbound,
      }),
    [conversationId],
  )

  return (
    <SimulatorPanel
      client={client}
      sse={conversationsSse}
      conversationId={conversationId}
      displayNumber={conversationId}
      onClose={onClose}
      loadMessages={(id) => conversationsApi.fetchMessages(id)}
    />
  )
}
