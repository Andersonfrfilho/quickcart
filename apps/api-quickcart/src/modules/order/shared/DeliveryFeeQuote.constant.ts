/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Os nomes da cotação de taxa por faixa — o contrato que bot, web e criação de pedido leem.
 */

export const DELIVERY_QUOTE_KIND = {
  PICKUP: 'pickup',
  QUOTED: 'quoted',
  APPROXIMATE_MAX_TIER: 'approximate_max_tier',
  OUT_OF_RANGE: 'out_of_range',
  UNAVAILABLE: 'unavailable',
} as const

export const DELIVERY_UNAVAILABLE_REASON = {
  NO_STORE_CEP: 'no_store_cep',
  NO_CUSTOMER_LOCATION: 'no_customer_location',
  GEOCODING_FAILED: 'geocoding_failed',
  NO_TIERS: 'no_tiers',
} as const

export type DeliveryUnavailableReason = (typeof DELIVERY_UNAVAILABLE_REASON)[keyof typeof DELIVERY_UNAVAILABLE_REASON]

export const DELIVERY_LOCATION_SOURCE = {
  WHATSAPP_LOCATION: 'whatsapp_location',
  CEP: 'cep',
  CEP_APPROXIMATE: 'cep_approximate',
} as const

export type DeliveryLocationSource = (typeof DELIVERY_LOCATION_SOURCE)[keyof typeof DELIVERY_LOCATION_SOURCE]

/** Para `z.enum(...)` em schema de resposta (card da conversa, painel) — mesmos três valores. */
export const DELIVERY_LOCATION_SOURCE_VALUES = [
  DELIVERY_LOCATION_SOURCE.WHATSAPP_LOCATION,
  DELIVERY_LOCATION_SOURCE.CEP,
  DELIVERY_LOCATION_SOURCE.CEP_APPROXIMATE,
] as const

export const CUSTOMER_LOCATION_KIND = {
  COORDINATES: 'coordinates',
  CEP: 'cep',
} as const
