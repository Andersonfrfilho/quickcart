/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A taxa de entrega fica FORA de `total_in_cents` (spec §3.4): a NFC-e usa o total como pagamento e não
 * admite frete. Por isso a regra da taxa e a soma "itens + taxa" vivem só aqui — nenhum outro lugar soma.
 * Recebem objetos simples, e não um pedido, para o resumo e o troco poderem chamar antes de o pedido existir.
 */

import { DELIVERY_TYPE } from '@/modules/order/shared/Order.constant'

export type ResolveDeliveryFeeInCentsParams = {
  readonly deliveryType: string
  readonly configuredFeeInCents: number
}

export type AmountDueInCentsParams = {
  readonly totalInCents: number
  readonly deliveryFeeInCents: number
}

export function resolveDeliveryFeeInCents(params: ResolveDeliveryFeeInCentsParams): number {
  if (params.deliveryType !== DELIVERY_TYPE.DELIVERY) return 0
  return params.configuredFeeInCents
}

export function amountDueInCents(params: AmountDueInCentsParams): number {
  return params.totalInCents + params.deliveryFeeInCents
}
