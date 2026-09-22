/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Textos da cotação de entrega no WhatsApp (spec §3.4). Distância com uma casa, em pt-BR — a mesma
 * que o pedido guarda; a coordenada nunca aparece.
 */

import type { QuoteDeliveryFeeResult } from '@/modules/order/application/types/QuoteDeliveryFee.types'
import { DELIVERY_QUOTE_KIND } from '@/modules/order/shared/DeliveryFeeQuote.constant'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { formatDistanceKm } from '@/shared/formatDistanceKm'

/** `undefined` quando a cotação não permite entregar — aí vale `buildDeliveryDeclinedMessage`. */
export function buildDeliveryFeeQuotedMessage(result: QuoteDeliveryFeeResult): string | undefined {
  if (result.kind === DELIVERY_QUOTE_KIND.QUOTED) {
    return MESSAGES.CHECKOUT_DELIVERY_FEE_QUOTED.replace('{distancia}', formatDistanceKm(result.distanceKm)).replace(
      '{valor}',
      formatPriceInCents(result.feeInCents),
    )
  }
  if (result.kind === DELIVERY_QUOTE_KIND.APPROXIMATE_MAX_TIER) {
    return MESSAGES.CHECKOUT_DELIVERY_FEE_APPROXIMATE.replace('{valor}', formatPriceInCents(result.feeInCents))
  }
  return undefined
}

export function buildDeliveryDeclinedMessage(result: QuoteDeliveryFeeResult): string {
  if (result.kind === DELIVERY_QUOTE_KIND.OUT_OF_RANGE) {
    return MESSAGES.CHECKOUT_DELIVERY_OUT_OF_RANGE.replace('{distancia}', formatDistanceKm(result.distanceKm)).replace(
      '{limite}',
      formatDistanceKm(result.maxDistanceKm),
    )
  }
  return MESSAGES.CHECKOUT_DELIVERY_UNAVAILABLE
}
