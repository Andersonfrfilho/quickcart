/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Rota pública (a loja navega sem login, como `checkout-config`): o limite de itens impede que
 * o corpo vire um vetor de abuso, já que cada item dispara uma leitura de produto no banco.
 */

import { z } from 'zod'
import { DELIVERY_TYPE, DELIVERY_TYPE_VALUES } from '@/modules/order/shared/Order.constant'
import { CHECKOUT_QUOTE_MAX_ITEMS, CHECKOUT_QUOTE_MAX_QUANTITY_PER_ITEM } from '@/modules/store/shared/Store.constant'

export const checkoutQuoteBodySchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.coerce.number().int().positive().max(CHECKOUT_QUOTE_MAX_QUANTITY_PER_ITEM),
        }),
      )
      .min(1)
      .max(CHECKOUT_QUOTE_MAX_ITEMS),
    deliveryType: z.enum(DELIVERY_TYPE_VALUES),
    /** Obrigatório na entrega (spec §3.5): sem CEP não há como cotar `QuoteDeliveryFee`. */
    cep: z.string().regex(/^\d{8}$/, 'CEP precisa ter 8 dígitos').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryType === DELIVERY_TYPE.DELIVERY && !data.cep) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cep'], message: 'Entrega exige CEP' })
    }
  })
