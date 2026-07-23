/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cliente HTTP para a única rota interna que o worker chama (docs/API.md — Interno).
 * Uma resposta não-2xx propaga como erro para o processor acionar o retry do BullMQ —
 * ao contrário do webhook da Meta, aqui não há motivo para engolir a falha.
 */

import { environment } from '@/infra/config/environment'

export type ResumeConversationParams = {
  readonly sessionId: string
  readonly transcript: string | null
}

class InternalApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export async function resumeConversation(params: ResumeConversationParams): Promise<void> {
  const response = await fetch(`${environment.API_BASE_URL}/v1/internal/conversation/resume`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.INTERNAL_API_TOKEN}`,
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new InternalApiError(`resume_conversation_failed: ${response.status} - ${body}`, response.status)
  }
}
