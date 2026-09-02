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
  DELIVERY_TYPE,
  DELIVERY_TYPE_VALUES,
  PAYMENT_METHOD_VALUES,
  RECEIPT_PREFERENCE_VALUES,
} from '@/modules/order/shared/Order.constant'
import { addressInputSchema } from '@/modules/shared/address/Address.schema'

export const createWebOrderBodySchema = z
  .object({
    customer: z.object({
      name: z.string().min(1),
      /*
       * Aceito por compatibilidade e IGNORADO: o telefone efetivo vem da sessão (ver o controller).
       * Continuar exigindo-o pediria à tela um dado que ela não usa mais.
       */
      phone: z.string().min(8).optional(),
      email: z.string().email().optional(),
    }),
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.coerce.number().int().positive(),
        }),
      )
      .min(1),
    deliveryType: z.enum(DELIVERY_TYPE_VALUES),
    address: addressInputSchema.optional(),
    paymentMethod: z.enum(PAYMENT_METHOD_VALUES),
    receiptPreference: z.enum(RECEIPT_PREFERENCE_VALUES),
    notes: z.string().optional(),
  })
  /*
   * O tipo de entrega decide se o endereço é obrigatório ou proibido, não opcional dos dois lados.
   *
   * Retirada com endereço enviado seria dado morto que ninguém lê — ou peor, um operador vendo
   * endereço num pedido de retirada e presumindo que é para entregar lá. Entrega sem endereço
   * chegaria ao banco sem coordenada nenhuma para geocodificar depois.
   */
  .superRefine((data, ctx) => {
    if (data.deliveryType === DELIVERY_TYPE.DELIVERY && !data.address) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['address'], message: 'Entrega exige endereço' })
    }
    if (data.deliveryType === DELIVERY_TYPE.PICKUP && data.address) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['address'], message: 'Retirada não tem endereço de entrega' })
    }
  })
