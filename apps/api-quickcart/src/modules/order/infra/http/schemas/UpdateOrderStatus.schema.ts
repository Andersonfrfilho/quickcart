/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { z } from 'zod'
import {
  DELIVERY_FAILURE_REASON_VALUES,
  ORDER_STATUS,
  ORDER_STATUS_VALUES,
} from '@/modules/order/shared/Order.constant'

/**
 * O motivo anda junto do status, e a fronteira exige um sem o outro.
 *
 * Ocorrência sem motivo deixaria o pedido parado sem ninguém saber se ainda cabe outra tentativa —
 * é o motivo, e não o status, que decide isso. E motivo em transição normal seria um "cliente
 * ausente" grudado num pedido entregue: o dado sobreviveria à viagem que o explicava.
 */
export const updateOrderStatusBodySchema = z
  .object({
    status: z.enum(ORDER_STATUS_VALUES),
    deliveryFailureReason: z.enum(DELIVERY_FAILURE_REASON_VALUES).optional(),
  })
  .superRefine((body, context) => {
    const isFailure = body.status === ORDER_STATUS.DELIVERY_FAILED

    if (isFailure && body.deliveryFailureReason === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['deliveryFailureReason'],
        message: 'deliveryFailureReason é obrigatório para registrar ocorrência',
      })
    }

    if (!isFailure && body.deliveryFailureReason !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['deliveryFailureReason'],
        message: 'deliveryFailureReason só é aceito com status delivery_failed',
      })
    }
  })
