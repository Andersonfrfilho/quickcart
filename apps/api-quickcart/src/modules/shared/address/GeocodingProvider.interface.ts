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

export interface GeocodingProviderInterface {
  /** `undefined` quando o CEP não resolve — nunca lança; quem chama decide seguir sem coordenada. */
  geocodeByCep(cep: string): Promise<GeocodeResult | undefined>
}
