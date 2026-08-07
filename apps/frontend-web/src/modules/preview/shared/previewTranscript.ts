/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Leitura do transcript no simulador, sem token de admin e sem assinatura.
 *
 * O simulador roda numa aba sem sessão — `sessionStorage` é por aba —, então ler pela API de admin
 * devolvia 401 e a conversa nunca aparecia. A rota de preview existe para isso, e quem a autoriza é
 * a flag `PREVIEW_TRANSCRIPT_ENABLED` do servidor: nada aqui precisa de segredo.
 */

import type { MessagePayload } from '@adatechnology/conversations-ui'
import { toMessagePayload, type ApiMessage } from '@/modules/conversations/shared/conversationsApi'

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export async function fetchPreviewTranscript(conversationId: string): Promise<MessagePayload[]> {
  const response = await fetch(
    `${API_BASE_URL}/v1/preview/conversations/${encodeURIComponent(conversationId)}/messages`,
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
