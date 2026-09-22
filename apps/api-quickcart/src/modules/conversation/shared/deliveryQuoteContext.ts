/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A cotação de entrega como ela vive no contexto do checkout: gravada inteira quando o endereço fica
 * pronto, apagada inteira quando o endereço deixa de valer. Um lugar só para as duas coisas, para uma
 * taxa velha nunca sobreviver ao lado de um endereço novo.
 */

import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import type { QuoteDeliveryFeeResult } from '@/modules/order/application/types/QuoteDeliveryFee.types'
import { DELIVERY_QUOTE_KIND } from '@/modules/order/shared/DeliveryFeeQuote.constant'

export type DeliveryQuoteContext = Pick<
  ConversationContext,
  | 'checkoutDeliveryFeeInCents'
  | 'checkoutDeliveryDistanceKm'
  | 'checkoutDeliveryTierMaxKm'
  | 'checkoutDeliveryTierFeeInCents'
  | 'checkoutDeliveryLocationSource'
>

const DELIVERY_QUOTE_KEYS = [
  'checkoutDeliveryFeeInCents',
  'checkoutDeliveryDistanceKm',
  'checkoutDeliveryTierMaxKm',
  'checkoutDeliveryTierFeeInCents',
  'checkoutDeliveryLocationSource',
] as const

export function withoutDeliveryQuote(context: ConversationContext): ConversationContext {
  const next: Record<string, unknown> = { ...context }
  for (const key of DELIVERY_QUOTE_KEYS) delete next[key]
  return next as ConversationContext
}

/** `undefined` quando a cotação não permite entregar (fora do raio, indisponível). */
export function toDeliveryQuoteContext(result: QuoteDeliveryFeeResult): DeliveryQuoteContext | undefined {
  if (result.kind === DELIVERY_QUOTE_KIND.QUOTED) {
    return {
      checkoutDeliveryFeeInCents: result.feeInCents,
      checkoutDeliveryDistanceKm: result.distanceKm,
      checkoutDeliveryTierMaxKm: result.tier.maxDistanceKm,
      checkoutDeliveryTierFeeInCents: result.tier.feeInCents,
      checkoutDeliveryLocationSource: result.source,
    }
  }
  if (result.kind === DELIVERY_QUOTE_KIND.APPROXIMATE_MAX_TIER) {
    return {
      checkoutDeliveryFeeInCents: result.feeInCents,
      checkoutDeliveryTierMaxKm: result.tier.maxDistanceKm,
      checkoutDeliveryTierFeeInCents: result.tier.feeInCents,
      checkoutDeliveryLocationSource: result.source,
    }
  }
  return undefined
}

/** Endereço final e rascunhos: somem juntos quando o cliente troca de endereço ou passa a retirar. */
export function withoutCheckoutAddress(context: ConversationContext): ConversationContext {
  const next: Record<string, unknown> = { ...context }
  delete next.checkoutAddress
  delete next.checkoutAddressDraft
  delete next.checkoutLocationDraft
  return next as ConversationContext
}
