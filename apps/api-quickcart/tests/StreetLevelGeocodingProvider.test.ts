/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Sem rede real: o `NominatimGeocodingProvider.geocodeByAddress` e o `AddressLookupProviderInterface`
 * são injetados como dublês. O que importa provar é a composição CEP → rua → coordenada, não o HTTP
 * (já coberto em `NominatimGeocodingProvider.structured.test.ts`).
 */

import { describe, expect, it } from 'bun:test'
import { StreetLevelGeocodingProvider } from '@/infra/geocoding/StreetLevelGeocodingProvider'
import { GEOCODE_OUTCOME_KIND, type GeocodeOutcome } from '@/modules/shared/address/GeocodingProvider.interface'
import { GEOCODE_PRECISION } from '@/modules/shared/address/Address.schema'
import type { AddressLookupProviderInterface, AddressLookupResult } from '@/modules/shared/address/AddressLookupProvider.interface'
import type { NominatimStreetAddressQuery } from '@/infra/nominatim/NominatimGeocodingProvider'

const STREET_FOUND: GeocodeOutcome = {
  kind: GEOCODE_OUTCOME_KIND.FOUND,
  coordinate: { latitude: -20.5681587, longitude: -47.3593474, precision: GEOCODE_PRECISION.STREET, provider: 'nominatim-street' },
}

function stubAddressLookup(result: AddressLookupResult | undefined): AddressLookupProviderInterface {
  return { async lookupByCep(): Promise<AddressLookupResult | undefined> { return result } }
}

function stubNominatim(outcome: GeocodeOutcome, calls: NominatimStreetAddressQuery[] = []) {
  return {
    async geocodeByAddress(address: NominatimStreetAddressQuery): Promise<GeocodeOutcome> {
      calls.push(address)
      return outcome
    },
  }
}

describe('StreetLevelGeocodingProvider', () => {
  it('busca estruturada com sucesso devolve precisão street', async () => {
    const calls: NominatimStreetAddressQuery[] = []
    const provider = new StreetLevelGeocodingProvider({
      addressLookupProvider: stubAddressLookup({
        street: 'Rua Radialista Alfeu Stabelini',
        neighborhood: 'Jardim Petraglia',
        city: 'Franca',
        state: 'SP',
      }),
      nominatimGeocodingProvider: stubNominatim(STREET_FOUND, calls),
    })

    const outcome = await provider.geocodeByCep('14403-000')

    expect(outcome).toEqual(STREET_FOUND)
    expect(calls).toEqual([{ street: 'Rua Radialista Alfeu Stabelini', city: 'Franca', state: 'SP' }])
  })

  it('endereço não encontrado no lookup cai para not_found sem chamar o Nominatim', async () => {
    const calls: NominatimStreetAddressQuery[] = []
    const provider = new StreetLevelGeocodingProvider({
      addressLookupProvider: stubAddressLookup(undefined),
      nominatimGeocodingProvider: stubNominatim(STREET_FOUND, calls),
    })

    const outcome = await provider.geocodeByCep('14403-000')

    expect(outcome).toEqual({ kind: GEOCODE_OUTCOME_KIND.NOT_FOUND })
    expect(calls).toEqual([])
  })

  it('Nominatim devolve not_found para a rua — repassa como está', async () => {
    const provider = new StreetLevelGeocodingProvider({
      addressLookupProvider: stubAddressLookup({ street: 'Rua X', neighborhood: '', city: 'Franca', state: 'SP' }),
      nominatimGeocodingProvider: stubNominatim({ kind: GEOCODE_OUTCOME_KIND.NOT_FOUND }),
    })

    expect(await provider.geocodeByCep('14403-000')).toEqual({ kind: GEOCODE_OUTCOME_KIND.NOT_FOUND })
  })

  it('429/5xx/timeout do Nominatim vira transient_error', async () => {
    const provider = new StreetLevelGeocodingProvider({
      addressLookupProvider: stubAddressLookup({ street: 'Rua X', neighborhood: '', city: 'Franca', state: 'SP' }),
      nominatimGeocodingProvider: stubNominatim({ kind: GEOCODE_OUTCOME_KIND.TRANSIENT_ERROR }),
    })

    expect(await provider.geocodeByCep('14403-000')).toEqual({ kind: GEOCODE_OUTCOME_KIND.TRANSIENT_ERROR })
  })

  it('CEP curto é not_found sem consultar nada', async () => {
    const calls: NominatimStreetAddressQuery[] = []
    const provider = new StreetLevelGeocodingProvider({
      addressLookupProvider: stubAddressLookup({ street: 'Rua X', neighborhood: '', city: 'Franca', state: 'SP' }),
      nominatimGeocodingProvider: stubNominatim(STREET_FOUND, calls),
    })

    expect(await provider.geocodeByCep('123')).toEqual({ kind: GEOCODE_OUTCOME_KIND.NOT_FOUND })
    expect(calls).toEqual([])
  })
})
