/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Só o erro da fila do recibo abre o caminho de reenvio; outros erros seguem o tratamento de sempre.
 */

import { describe, expect, it } from 'bun:test'
import { AxiosError, AxiosHeaders } from 'axios'

import { ORDER_RECEIPT_ENQUEUE_FAILED, readReceiptEnqueueFailure } from './receiptEnqueueFailure'

function buildApiError(code: string, message: string): AxiosError {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, undefined, {
    status: 503,
    statusText: 'Service Unavailable',
    headers: {},
    config,
    data: { error: { code, message } },
  })
}

describe('readReceiptEnqueueFailure', () => {
  it('devolve a mensagem da API quando o código é o da fila do recibo', () => {
    const message = 'Status salvo, mas o recibo não foi enviado para emissão. Tente marcar de novo.'
    expect(readReceiptEnqueueFailure(buildApiError(ORDER_RECEIPT_ENQUEUE_FAILED, message))).toBe(message)
  })

  it('ignora outros erros da API', () => {
    expect(readReceiptEnqueueFailure(buildApiError('ORDER_INVALID_STATUS_TRANSITION', 'x'))).toBeUndefined()
    expect(readReceiptEnqueueFailure(new Error('rede'))).toBeUndefined()
  })
})
