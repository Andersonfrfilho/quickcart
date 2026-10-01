/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { DeliveryFeeTier } from '@/modules/order/domain/DeliveryFeeTierRepository.interface'
import type {
  CUSTOMER_LOCATION_KIND,
  DELIVERY_LOCATION_SOURCE,
  DELIVERY_QUOTE_KIND,
  DeliveryUnavailableReason,
} from '@/modules/order/shared/DeliveryFeeQuote.constant'
import type { DeliveryType } from '@/modules/order/shared/Order.constant'

export type CustomerLocation =
  | {
      readonly kind: typeof CUSTOMER_LOCATION_KIND.COORDINATES
      readonly latitude: number
      readonly longitude: number
    }
  | { readonly kind: typeof CUSTOMER_LOCATION_KIND.CEP; readonly cep: string }

export type QuoteDeliveryFeeParams = {
  readonly deliveryType: DeliveryType
  readonly location?: CustomerLocation | undefined
}

export type QuoteDeliveryFeeResult =
  | { readonly kind: typeof DELIVERY_QUOTE_KIND.PICKUP; readonly feeInCents: 0 }
  | {
      readonly kind: typeof DELIVERY_QUOTE_KIND.QUOTED
      readonly feeInCents: number
      readonly distanceKm: number
      readonly tier: DeliveryFeeTier
      readonly source: typeof DELIVERY_LOCATION_SOURCE.WHATSAPP_LOCATION | typeof DELIVERY_LOCATION_SOURCE.CEP
    }
  | {
      readonly kind: typeof DELIVERY_QUOTE_KIND.APPROXIMATE_MAX_TIER
      readonly feeInCents: number
      readonly tier: DeliveryFeeTier
      readonly source: typeof DELIVERY_LOCATION_SOURCE.CEP_APPROXIMATE
    }
  | {
      readonly kind: typeof DELIVERY_QUOTE_KIND.OUT_OF_RANGE
      readonly distanceKm: number
      readonly maxDistanceKm: number
    }
  | { readonly kind: typeof DELIVERY_QUOTE_KIND.UNAVAILABLE; readonly reason: DeliveryUnavailableReason }
