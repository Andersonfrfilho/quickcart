/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * De onde recotar a entrega lembrada ("Isso mesmo"): a coordenada de quem mandou a localização, ou o
 * CEP do endereço estruturado. Endereço em texto livre (pedido de antes da taxa por faixa) não tem
 * nenhum dos dois e devolve `undefined` — o atalho cai e o cliente informa o endereço de novo.
 */

import type { CustomerLocation } from '@/modules/order/application/types/QuoteDeliveryFee.types'
import { CUSTOMER_LOCATION_KIND } from '@/modules/order/shared/DeliveryFeeQuote.constant'
import { isWhatsAppLocationAddress } from '@/modules/shared/address/WhatsAppLocationAddress'

const CEP_DIGITS = 8

export function extractRememberedLocation(address: unknown): CustomerLocation | undefined {
  if (isWhatsAppLocationAddress(address)) {
    return { kind: CUSTOMER_LOCATION_KIND.COORDINATES, latitude: address.latitude, longitude: address.longitude }
  }
  if (!address || typeof address !== 'object') return undefined

  const cep = (address as Record<string, unknown>).cep
  if (typeof cep !== 'string') return undefined
  const digits = cep.replace(/\D/g, '')
  return digits.length === CEP_DIGITS ? { kind: CUSTOMER_LOCATION_KIND.CEP, cep: digits } : undefined
}
