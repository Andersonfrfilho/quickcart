/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Stream de um pedido. O evento não traz o pedido, só o aviso de que ele mudou — quem recebe refaz a
 * busca pela rota de detalhe, que continua sendo o único lugar que sabe desenhar um pedido.
 */

import { createDeferredEventSource, type TicketedEventSource } from '@/shared/sse/deferredEventSource'
import { getAccessToken } from '@/modules/auth/shared/sessionStore'

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const ADMIN_BASE_PATH = '/v1/admin'

export const ORDER_CHANGED_EVENT = 'order.changed'

export type OrderChangedEvent = {
  readonly orderId: string
  readonly reason: string
}

async function issueOrderTicket(orderId: string): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}${ADMIN_BASE_PATH}/orders/stream-ticket?order=${encodeURIComponent(orderId)}`,
    { method: 'POST', headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` } },
  )

  if (!response.ok) throw new Error(`Não foi possível abrir o stream do pedido (${response.status}).`)

  const body = (await response.json()) as { data: { ticket: string } }
  return body.data.ticket
}

export function connectOrderStream(params: {
  readonly orderId: string
  readonly onConnectionChange?: (isConnected: boolean) => void
}): TicketedEventSource {
  return createDeferredEventSource({
    issueTicket: () => issueOrderTicket(params.orderId),
    streamUrl: (ticket) =>
      `${API_BASE_URL}${ADMIN_BASE_PATH}/orders/${encodeURIComponent(params.orderId)}/stream?ticket=${ticket}`,
    ...(params.onConnectionChange ? { onConnectionChange: params.onConnectionChange } : {}),
  })
}
