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
import { getServiceAccessToken, invalidateServiceSession } from './ServiceSession'

const UNAUTHORIZED_STATUS = 401

export type ResumeConversationParams = {
  readonly sessionId: string
  readonly transcript: string | null
}

class InternalApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function postResume(params: ResumeConversationParams): Promise<Response> {
  return fetch(`${environment.API_BASE_URL}/v1/internal/conversation/resume`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await getServiceAccessToken()}`,
    },
    body: JSON.stringify(params),
  })
}

export async function resumeConversation(params: ResumeConversationParams): Promise<void> {
  let response = await postResume(params)

  /*
   * Uma única retentativa no 401, e só nele: o access token dura 15 minutos, então um job que ficou
   * na fila além disso encontra a sessão vencida. Descartar e reautenticar é mais barato — e mais
   * correto — do que devolver o job ao BullMQ para falhar de novo pelo mesmo motivo.
   */
  if (response.status === UNAUTHORIZED_STATUS) {
    invalidateServiceSession()
    response = await postResume(params)
  }

  if (!response.ok) {
    const body = await response.text()
    throw new InternalApiError(`resume_conversation_failed: ${response.status} - ${body}`, response.status)
  }
}
