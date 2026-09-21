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

type PostInternalParams = { readonly path: string; readonly body: unknown; readonly operation: string }

function sendInternal(params: PostInternalParams, accessToken: string): Promise<Response> {
  return fetch(`${environment.API_BASE_URL}${params.path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(params.body),
  })
}

/**
 * Toda chamada do worker à api passa por aqui, com a sessão de serviço.
 *
 * Uma única retentativa no 401, e só nele: o access token dura 15 minutos, então um job que ficou
 * na fila além disso encontra a sessão vencida. Descartar e reautenticar é mais barato — e mais
 * correto — do que devolver o job ao BullMQ para falhar de novo pelo mesmo motivo.
 */
async function postInternal(params: PostInternalParams): Promise<void> {
  let response = await sendInternal(params, await getServiceAccessToken())

  if (response.status === UNAUTHORIZED_STATUS) {
    invalidateServiceSession()
    response = await sendInternal(params, await getServiceAccessToken())
  }

  if (!response.ok) {
    const body = await response.text()
    throw new InternalApiError(`${params.operation}_failed: ${response.status} - ${body}`, response.status)
  }
}

export async function resumeConversation(params: ResumeConversationParams): Promise<void> {
  await postInternal({ path: '/v1/internal/conversation/resume', body: params, operation: 'resume_conversation' })
}

export async function remindCustomerDecision(params: { readonly orderId: string }): Promise<void> {
  await postInternal({
    path: `/v1/internal/orders/${params.orderId}/decision-reminder`,
    body: {},
    operation: 'remind_customer_decision',
  })
}
