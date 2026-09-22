/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Contrato do card "pedido em andamento" do painel. `.strict()` é o que impede a rota de vazar o
 * contexto da sessão inteiro (nome, e-mail, rascunhos) se alguém espalhar um objeto a mais aqui.
 */

import { z } from 'zod'

import { DELIVERY_TYPE_VALUES, PAYMENT_METHOD_VALUES } from '@/modules/order/shared/Order.constant'

const CENTS = z.number().int().nonnegative()

export const CHECKOUT_CONTEXT_ITEM_SCHEMA = z
  .object({
    name: z.string(),
    quantity: z.number().positive(),
    lineTotalInCents: CENTS,
  })
  .strict()

export const CHECKOUT_CONTEXT_RESPONSE_SCHEMA = z
  .object({
    items: z.array(CHECKOUT_CONTEXT_ITEM_SCHEMA),
    subtotalInCents: CENTS,
    deliveryType: z.enum(DELIVERY_TYPE_VALUES).nullable(),
    deliveryFeeInCents: CENTS,
    amountDueInCents: CENTS,
    address: z.string().nullable(),
    paymentMethod: z.enum(PAYMENT_METHOD_VALUES).nullable(),
    cashChangeForInCents: CENTS.nullable(),
  })
  .strict()
