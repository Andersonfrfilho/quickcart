/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Download do transcript. Usa a rota de export, e não as mensagens já em tela, porque a listagem do
 * painel é paginada — baixar o que está visível entregaria um histórico truncado justamente para
 * quem quer auditoria.
 */

import { buildTranscriptFilename, buildTranscriptText, downloadTextFile } from '@adatechnology/conversations-ui'
import { adminRequest } from '@/modules/admin/shared/adminRequest'
import { toMessagePayload, type ApiMessage } from '@/modules/conversations/shared/conversationsApi'

type ExportConversationResponse = {
  readonly session: { readonly whatsappNumber: string }
  readonly messages: readonly ApiMessage[]
}

export type DownloadConversationParams = {
  readonly conversationId: string
  readonly clientName?: string | undefined
}

export async function downloadConversation(params: DownloadConversationParams): Promise<void> {
  const exported = await adminRequest<ExportConversationResponse>(
    `/conversations/${encodeURIComponent(params.conversationId)}/export`,
  )

  const text = buildTranscriptText({
    messages: exported.messages.map(toMessagePayload),
    whatsappNumber: exported.session.whatsappNumber,
    clientName: params.clientName,
  })

  downloadTextFile(buildTranscriptFilename(exported.session.whatsappNumber, new Date()), text)
}
