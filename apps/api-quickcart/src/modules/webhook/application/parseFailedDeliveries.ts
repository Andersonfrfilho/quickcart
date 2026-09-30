/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Por que a Meta recusou a entrega. O módulo marca a mensagem como `failed` e descarta o motivo, que
 * só existe no corpo do webhook de status — e sem ele todo envio recusado vira silêncio idêntico ao
 * de um bug nosso: o cliente não recebe nada, e o log não sabe dizer de quem é a culpa. Custou uma
 * investigação inteira — e duas hipóteses erradas — descobrir que a conta estava barrada de mandar
 * mensagem para o Brasil (130497). Com este log, a mesma pergunta se responde na primeira recusa.
 *
 * Parser tolerante de propósito: isto alimenta log, não decisão. Corpo inesperado devolve lista
 * vazia — nunca lança, porque derrubar o webhook por causa de observabilidade é trocar um problema
 * por um pior.
 *
 * O id do envio sai hasheado: o `wamid` é base64 com o telefone do destinatário dentro, então
 * ele é PII disfarçada de identificador opaco (ver `hashWaMessageId`).
 *
 * `recipient_id` fica de fora: é o telefone do cliente, e log com PII é proibido (security.md §1).
 */

import { z } from 'zod'

import { hashWaMessageId } from '@/shared/hashWaMessageId'

const failedStatusSchema = z.object({
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              value: z
                .object({
                  statuses: z
                    .array(
                      z.object({
                        id: z.string().optional(),
                        status: z.string().optional(),
                        errors: z
                          .array(
                            z.object({
                              code: z.number().optional(),
                              title: z.string().optional(),
                              error_data: z.object({ details: z.string().optional() }).optional(),
                            }),
                          )
                          .optional(),
                      }),
                    )
                    .optional(),
                })
                .optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
})

export type FailedDelivery = {
  readonly waMessageIdHash: string | undefined
  readonly code: number | undefined
  readonly title: string | undefined
  readonly details: string | undefined
}

const FAILED_STATUS = 'failed'

export function parseFailedDeliveries(rawBody: string): readonly FailedDelivery[] {
  const parsed = safeParseJson(rawBody)
  if (parsed === undefined) return []

  const result = failedStatusSchema.safeParse(parsed)
  if (!result.success) return []

  return (result.data.entry ?? []).flatMap((entry) =>
    (entry.changes ?? []).flatMap((change) =>
      (change.value?.statuses ?? [])
        .filter((status) => status.status === FAILED_STATUS)
        .map((status) => {
          const error = status.errors?.[0]
          return {
            waMessageIdHash: hashWaMessageId(status.id),
            code: error?.code,
            title: error?.title,
            details: error?.error_data?.details,
          }
        }),
    ),
  )
}

function safeParseJson(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody) as unknown
  } catch {
    return undefined
  }
}
