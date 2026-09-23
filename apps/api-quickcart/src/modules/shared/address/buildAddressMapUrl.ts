/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Link de mapa do endereço de entrega, para o cliente conferir antes de confirmar e para quem leva
 * o pedido abrir a rota sem redigitar rua e número.
 *
 * Link, e não mensagem `location` do WhatsApp: o provider (`@adatechnology/meta-whatsapp-provider`)
 * não expõe envio de localização — só texto, mídia, template, interativo e catálogo. O link abre o
 * mesmo app de mapa no telefone e não depende de uma versão nova do pacote.
 *
 * Endereço estruturado vai como BUSCA TEXTUAL, nunca como a coordenada que o pedido carrega — mesma
 * decisão do link de rota do painel (`orderMapsLink.ts`): a nossa coordenada vem do CEP e chega à
 * quadra, enquanto o Maps conhece numeração predial. O CEP entra na busca porque desambigua rua de
 * mesmo nome; complemento e referência ficam fora, porque só confundem o geocodificador.
 *
 * A exceção é a localização que o próprio cliente mandou: ali a coordenada É o ponto exato.
 */

import { isWhatsAppLocationAddress } from '@/modules/shared/address/WhatsAppLocationAddress'

const MAPS_SEARCH_BASE_URL = 'https://www.google.com/maps/search/?api=1&query='

type StructuredAddressLike = {
  readonly cep?: string
  readonly street: string
  readonly number: string
  readonly neighborhood: string
  readonly city: string
  readonly state: string
}

function isStructuredAddressLike(address: unknown): address is StructuredAddressLike {
  if (!address || typeof address !== 'object') return false
  const candidate = address as Record<string, unknown>
  return (
    typeof candidate.street === 'string' &&
    typeof candidate.number === 'string' &&
    typeof candidate.neighborhood === 'string' &&
    typeof candidate.city === 'string' &&
    typeof candidate.state === 'string'
  )
}

export function buildAddressMapUrl(address: unknown): string | undefined {
  if (isWhatsAppLocationAddress(address)) {
    return `${MAPS_SEARCH_BASE_URL}${address.latitude},${address.longitude}`
  }

  if (isStructuredAddressLike(address)) {
    const query = [
      `${address.street}, ${address.number}`,
      address.neighborhood,
      `${address.city} - ${address.state}`,
      address.cep,
    ]
      .filter((part): part is string => Boolean(part))
      .join(', ')
    return `${MAPS_SEARCH_BASE_URL}${encodeURIComponent(query)}`
  }

  return undefined
}
