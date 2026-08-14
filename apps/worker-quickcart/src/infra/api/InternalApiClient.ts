/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cliente HTTP para as rotas internas que o worker chama (docs/API.md — Interno).
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

async function postInternal(params: { readonly path: string; readonly body: unknown; readonly operation: string }): Promise<void> {
  const response = await fetch(`${environment.API_BASE_URL}${params.path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.INTERNAL_API_TOKEN}`,
    },
    body: JSON.stringify(params.body),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new InternalApiError(`${params.operation}_failed: ${response.status} - ${body}`, response.status)
  }
}

export async function resumeConversation(params: ResumeConversationParams): Promise<void> {
  await postInternal({ path: '/v1/internal/conversation/resume', body: params, operation: 'resume_conversation' })
}

/**
 * Cobra a decisão do cliente. Vai pela API, e não direto no banco, porque a cobrança precisa do mesmo
 * texto, dos mesmos botões e do mesmo carimbo condicional que o aviso original — regra de negócio que
 * mora na API. Duplicá-la aqui seria a segunda implementação que erra.
 */
export async function remindCustomerDecision(params: { readonly orderId: string }): Promise<void> {
  await postInternal({
    path: `/v1/internal/orders/${params.orderId}/decision-reminder`,
    body: {},
    operation: 'remind_customer_decision',
  })
}
