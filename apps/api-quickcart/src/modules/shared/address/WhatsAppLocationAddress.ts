/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Endereço de quem mandou a localização pelo WhatsApp (spec §3.2): a coordenada exata no lugar do CEP,
 * mais o número e o complemento que o entregador precisa. Fica fora do `addressSchema` de propósito —
 * aquele é o que o checkout web aceita, e lá o cliente não pode injetar coordenada. Nunca em log.
 */

export type WhatsAppLocationAddress = {
  readonly latitude: number
  readonly longitude: number
  readonly number: string
  readonly complement?: string
}

export function isWhatsAppLocationAddress(address: unknown): address is WhatsAppLocationAddress {
  if (!address || typeof address !== 'object') return false
  const candidate = address as Record<string, unknown>
  return (
    typeof candidate.latitude === 'number' &&
    typeof candidate.longitude === 'number' &&
    typeof candidate.number === 'string'
  )
}
