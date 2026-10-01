/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O pedido saiu da loja, o status foi salvo, e o recibo não entrou na fila. A API avisa com código
 * próprio; marcar o MESMO status de novo só reenfileira (sem regravar nem avisar o cliente).
 */

import { isAxiosError } from 'axios'

export const ORDER_RECEIPT_ENQUEUE_FAILED = 'ORDER_RECEIPT_ENQUEUE_FAILED'

type ApiErrorBody = { readonly error?: { readonly code?: unknown; readonly message?: unknown } }

/** Mensagem da API quando o erro é a fila do recibo; `undefined` para qualquer outro erro. */
export function readReceiptEnqueueFailure(error: unknown): string | undefined {
  if (!isAxiosError<ApiErrorBody>(error)) return undefined
  const body = error.response?.data?.error
  if (body?.code !== ORDER_RECEIPT_ENQUEUE_FAILED) return undefined
  return typeof body.message === 'string' ? body.message : undefined
}
