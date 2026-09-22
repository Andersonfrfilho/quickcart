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
import { DELIVERY_LOCATION_SOURCE_VALUES } from '@/modules/order/shared/DeliveryFeeQuote.constant'

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
    /** `null` = entrega ainda sem cotação por faixa (endereço não informado) — nunca "grátis". */
    deliveryFeeInCents: CENTS.nullable(),
    /** Só em cotação `quoted` — a aproximada pela cidade (D3) não calcula a distância da casa. */
    deliveryDistanceKm: z.number().nonnegative().nullable(),
    deliveryTierMaxKm: z.number().positive().nullable(),
    /** `whatsapp_location` | `cep` | `cep_approximate` — nunca a coordenada nem o CEP em si. */
    deliveryLocationSource: z.enum(DELIVERY_LOCATION_SOURCE_VALUES).nullable(),
    amountDueInCents: CENTS,
    address: z.string().nullable(),
    paymentMethod: z.enum(PAYMENT_METHOD_VALUES).nullable(),
    cashChangeForInCents: CENTS.nullable(),
  })
  .strict()
