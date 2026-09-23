/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * CEP → coordenada de rua, em dois saltos: CEP → rua/cidade/UF pelo `AddressLookupProviderInterface`
 * já encadeado (BrasilAPI, depois ViaCEP), rua/cidade/UF → coordenada pela busca estruturada do
 * Nominatim (`NominatimGeocodingProvider.geocodeByAddress`). Entra PRIMEIRO na cadeia de
 * geocodificação porque, quando resolve, devolve precisão `street` — a única que dispensa a
 * confirmação de "faixa máxima" que a precisão `city` da BrasilAPI (centroide do município) obriga.
 */

import {
  GEOCODE_OUTCOME_KIND,
  type GeocodeOutcome,
  type GeocodingProviderInterface,
} from '@/modules/shared/address/GeocodingProvider.interface'
import type { AddressLookupProviderInterface } from '@/modules/shared/address/AddressLookupProvider.interface'
import type { NominatimGeocodingProvider } from '@/infra/nominatim/NominatimGeocodingProvider'

const NOT_FOUND: GeocodeOutcome = { kind: GEOCODE_OUTCOME_KIND.NOT_FOUND }

type StreetLevelGeocodingProviderDependencies = {
  readonly addressLookupProvider: AddressLookupProviderInterface
  readonly nominatimGeocodingProvider: Pick<NominatimGeocodingProvider, 'geocodeByAddress'>
}

export class StreetLevelGeocodingProvider implements GeocodingProviderInterface {
  constructor(private readonly dependencies: StreetLevelGeocodingProviderDependencies) {}

  async geocodeByCep(cep: string): Promise<GeocodeOutcome> {
    const digitsOnly = cep.replace(/\D/g, '')
    if (digitsOnly.length !== 8) return NOT_FOUND

    const address = await this.dependencies.addressLookupProvider.lookupByCep(digitsOnly)
    if (!address?.street || !address.city || !address.state) return NOT_FOUND

    return this.dependencies.nominatimGeocodingProvider.geocodeByAddress({
      street: address.street,
      city: address.city,
      state: address.state,
    })
  }
}
