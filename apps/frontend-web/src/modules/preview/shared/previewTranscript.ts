/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Leitura do transcript no simulador, assinada com o app secret em vez de token de admin.
 *
 * O simulador roda numa aba sem sessão — `sessionStorage` é por aba —, então ler pela API de admin
 * devolvia 401 e a conversa nunca aparecia. Ele já prova identidade para ENTREGAR a mensagem
 * (HMAC no webhook); agora prova do mesmo jeito para LER.
 */

import { signPreviewPayload } from '@adatechnology/conversations-ui/preview'
import type { MessagePayload } from '@adatechnology/conversations-ui'
import { toMessagePayload, type ApiMessage } from '@/modules/conversations/shared/conversationsApi'
import { readPreviewEnvironment } from '@/modules/preview/shared/previewEnvironment'

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export async function fetchPreviewTranscript(conversationId: string): Promise<MessagePayload[]> {
  const { appSecret } = readPreviewEnvironment()
  // A assinatura cobre o número pedido: capturada, não serve para ler outra conversa.
  const signature = await signPreviewPayload({ rawBody: conversationId, appSecret })

  const response = await fetch(
    `${API_BASE_URL}/v1/preview/conversations/${encodeURIComponent(conversationId)}/messages`,
    { headers: { 'x-preview-signature': signature } },
  )

  if (!response.ok) {
    const error = new Error(`Falha ao ler o transcript do preview (${response.status})`)
    // Status preservado para o SDK distinguir "conversa ainda não existe" de falha real.
    Object.assign(error, { status: response.status })
    throw error
  }

  const body = (await response.json()) as { data: readonly ApiMessage[] }
  return body.data.map(toMessagePayload)
}
