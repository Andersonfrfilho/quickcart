/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * CEP → coordenada. Separado de `AddressLookupProviderInterface` (CEP → rua/bairro) porque são
 * provedores diferentes por necessidade, não por organização: o ViaCEP não tem o campo de
 * coordenada, e a BrasilAPI anuncia o campo e devolve `{}` (medido na spec §4.1, três capitais).
 */

import type { GeocodePrecision } from '@/modules/shared/address/Address.schema'

export type GeocodeResult = {
  readonly latitude: number
  readonly longitude: number
  /** O quanto essa coordenada vale — decide se a tela promete horário ou só distância aproximada. */
  readonly precision: GeocodePrecision
  /** Quem respondeu. Fica gravado no cache para uma troca de provedor não virar dado de origem desconhecida. */
  readonly provider: string
}

export const GEOCODE_OUTCOME_KIND = {
  FOUND: 'found',
  /** O provedor respondeu e não achou: é isso que vai para o cache negativo de 24h. */
  NOT_FOUND: 'not_found',
  /** Rede, timeout, 429/5xx, fila cheia: não diz nada sobre o CEP, então NÃO pode ir para o cache negativo. */
  TRANSIENT_ERROR: 'transient_error',
} as const

export type GeocodeOutcome =
  | { readonly kind: typeof GEOCODE_OUTCOME_KIND.FOUND; readonly coordinate: GeocodeResult }
  | { readonly kind: typeof GEOCODE_OUTCOME_KIND.NOT_FOUND }
  | { readonly kind: typeof GEOCODE_OUTCOME_KIND.TRANSIENT_ERROR }

export interface GeocodingProviderInterface {
  /** Nunca lança; distingue "não achou" de "não deu para perguntar" para o cache negativo não mentir. */
  geocodeByCep(cep: string): Promise<GeocodeOutcome>
}
