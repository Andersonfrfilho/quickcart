/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Provedores de endereço da seed, sem rede. A seed passou a cotar a entrega de verdade, e o CI roda
 * sem saída para ViaCEP/Nominatim: com os provedores reais, `make seed` morria em
 * `Não foi possível calcular a taxa de entrega`. Coordenada fixa também mantém a seed determinística
 * — um provedor real mudaria a distância do pedido de exemplo a cada execução.
 */

import type {
  AddressLookupProviderInterface,
  AddressLookupResult,
} from '@/modules/shared/address/AddressLookupProvider.interface'
import type {
  GeocodeOutcome,
  GeocodingProviderInterface,
} from '@/modules/shared/address/GeocodingProvider.interface'
import { GEOCODE_OUTCOME_KIND } from '@/modules/shared/address/GeocodingProvider.interface'
import { GEOCODE_PRECISION } from '@/modules/shared/address/Address.schema'
import { SEED_ORDER_CUSTOMERS } from './OrderSeedCustomers'

const SEED_GEOCODE_PROVIDER_NAME = 'seed-offline'

type SeedCoordinate = {
  readonly latitude: number
  readonly longitude: number
  readonly precision: (typeof GEOCODE_PRECISION)[keyof typeof GEOCODE_PRECISION]
}

/**
 * Coordenadas reais das localidades, medidas uma vez e congeladas aqui. O CEP genérico de Piumhi
 * entra com precisão de município de propósito: é o caso D3 da spec (cobra a maior faixa).
 */
const SEED_COORDINATE_BY_CEP: Readonly<Record<string, SeedCoordinate>> = {
  '01415000': { latitude: -23.5566, longitude: -46.662, precision: GEOCODE_PRECISION.STREET },
  '01310100': { latitude: -23.5613, longitude: -46.6565, precision: GEOCODE_PRECISION.STREET },
  '04101300': { latitude: -23.5875, longitude: -46.6375, precision: GEOCODE_PRECISION.STREET },
  '02011000': { latitude: -23.5107, longitude: -46.6254, precision: GEOCODE_PRECISION.STREET },
  '09010000': { latitude: -23.6634, longitude: -46.5323, precision: GEOCODE_PRECISION.STREET },
  '37925000': { latitude: -20.4667, longitude: -45.9583, precision: GEOCODE_PRECISION.CITY },
}

function normalizeCep(cep: string): string {
  return cep.replace(/\D/g, '')
}

export class SeedOfflineGeocodingProvider implements GeocodingProviderInterface {
  async geocodeByCep(cep: string): Promise<GeocodeOutcome> {
    const coordinate = SEED_COORDINATE_BY_CEP[normalizeCep(cep)]
    if (!coordinate) return { kind: GEOCODE_OUTCOME_KIND.NOT_FOUND }

    return {
      kind: GEOCODE_OUTCOME_KIND.FOUND,
      coordinate: { ...coordinate, provider: SEED_GEOCODE_PROVIDER_NAME },
    }
  }
}

const SEED_ADDRESS_BY_CEP: Readonly<Record<string, AddressLookupResult>> = Object.fromEntries(
  SEED_ORDER_CUSTOMERS.filter((customer) => customer.address).map((customer) => [
    normalizeCep(customer.address!.cep),
    {
      street: customer.address!.street,
      neighborhood: customer.address!.neighborhood,
      city: customer.address!.city,
      state: customer.address!.state,
    },
  ]),
)

export class SeedOfflineAddressLookupProvider implements AddressLookupProviderInterface {
  async lookupByCep(cep: string): Promise<AddressLookupResult | undefined> {
    return SEED_ADDRESS_BY_CEP[normalizeCep(cep)]
  }
}
