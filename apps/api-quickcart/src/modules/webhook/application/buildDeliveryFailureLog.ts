/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Por que a Meta recusou a entrega, em forma de linha de log. Sem o motivo, toda recusa é idêntica
 * ao silêncio de um bug nosso: o cliente não recebe nada e o log não sabe dizer de quem é a culpa.
 * Custou uma investigação inteira — e duas hipóteses erradas — descobrir que a conta estava barrada
 * de mandar mensagem para o Brasil (130497).
 *
 * Função pura e separada do hook porque o que precisa de teste aqui não é o `console`: é a garantia
 * de que o telefone do cliente não sai junto. O `wamid` vai hasheado (é base64 com o número do
 * destinatário dentro) e o `recipient_id`, que é o número em claro, fica de fora — log com PII é
 * proibido (security.md §1).
 */

import { hashWaMessageId, type WhatsAppStatus } from '@adatechnology/meta-whatsapp-contracts'

const FAILED_DELIVERY_STATUS = 'failed'

export type DeliveryFailureLog = {
  readonly waMessageIdHash: string | undefined
  readonly code: number | undefined
  readonly title: string | undefined
  readonly details: string | undefined
}

export function buildDeliveryFailureLog(status: WhatsAppStatus): DeliveryFailureLog | undefined {
  if (status.status !== FAILED_DELIVERY_STATUS) return undefined

  const failure = status.errors?.[0]

  return {
    waMessageIdHash: hashWaMessageId(status.id),
    code: failure?.code,
    title: failure?.title,
    details: failure?.error_data?.details,
  }
}
