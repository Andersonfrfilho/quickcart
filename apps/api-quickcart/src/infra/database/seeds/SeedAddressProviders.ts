/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Dublês de `AddressLookupProviderInterface` e `GeocodingProviderInterface` SÓ para a seed de
 * pedidos (`OrderSeedRunner.ts`). `CreateWebOrderUseCase` sempre cota a entrega de verdade — ViaCEP
 * para o endereço, Nominatim para a coordenada (T6.1) — e o CI não tem rede para nenhum dos dois:
 * `make seed ENV=test` roda sem o servidor no ar, então nem a chamada nem o cache em banco existem
 * ainda quando a seed tenta criar o primeiro pedido de entrega.
 *
 * As coordenadas abaixo são aproximações reais (não inventadas) dos mesmos CEPs listados em
 * `OrderSeedCustomers.ts`, medidas para reproduzir as distâncias que os comentários ali descrevem.
 * Isto NÃO toca o caminho de produção: `CreateWebOrderUseCase` continua recebendo
 * `ViaCepAddressLookupProvider`/`NominatimGeocodingProvider` reais em `src/index.ts` — só a seed
 * troca a dependência, pela mesma injeção de interface que o use case já aceitava.
 */

import type {
  AddressLookupProviderInterface,
  AddressLookupResult,
} from '@/modules/shared/address/AddressLookupProvider.interface'
import {
  GEOCODE_OUTCOME_KIND,
  type GeocodeOutcome,
  type GeocodingProviderInterface,
} from '@/modules/shared/address/GeocodingProvider.interface'
import { GEOCODE_PRECISION } from '@/modules/shared/address/Address.schema'

const PROVIDER_NAME = 'seed-stub'

type SeedAddressFixture = AddressLookupResult & {
  readonly latitude: number
  readonly longitude: number
  readonly precision: (typeof GEOCODE_PRECISION)[keyof typeof GEOCODE_PRECISION]
}

/**
 * Chave é o CEP só com dígitos. Cobre o CEP da loja (`STORE_CEP=01415-000`, spec de dev) e todo
 * endereço de `SEED_ORDER_CUSTOMERS` — o pickup (Pedro Henrique Lima) não entra aqui porque nunca
 * chama nenhum dos dois provedores.
 */
const SEED_ADDRESS_FIXTURES: Readonly<Record<string, SeedAddressFixture>> = {
  // Loja de dev: Consolação, SP.
  '01415000': {
    street: 'Rua da Consolação',
    neighborhood: 'Consolação',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.5573,
    longitude: -46.6602,
    precision: GEOCODE_PRECISION.POSTAL_CODE,
  },
  // Maria Aparecida — perto (~2 km), Avenida Paulista.
  '01310100': {
    street: 'Avenida Paulista',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.5615,
    longitude: -46.6553,
    precision: GEOCODE_PRECISION.STREET,
  },
  // Antônio Carlos — meia distância (~6,3 km), Vila Mariana.
  '04101300': {
    street: 'Rua Domingos de Morais',
    neighborhood: 'Vila Mariana',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.5875,
    longitude: -46.6417,
    precision: GEOCODE_PRECISION.STREET,
  },
  // Joana Pires — borda do raio (~6,7 km), Santana.
  '02011000': {
    street: 'Rua Voluntários da Pátria',
    neighborhood: 'Santana',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.5054,
    longitude: -46.6206,
    precision: GEOCODE_PRECISION.STREET,
  },
  // Rafael Souza — fora do raio (~23,7 km), Santo André.
  '09010000': {
    street: 'Rua Coronel Oliveira Lima',
    neighborhood: 'Centro',
    city: 'Santo André',
    state: 'SP',
    latitude: -23.6536,
    longitude: -46.5383,
    precision: GEOCODE_PRECISION.STREET,
  },
  // Bianca Nogueira — CEP genérico `-000` de cidade pequena, precisão de município.
  '37925000': {
    street: 'Rua Sete de Setembro',
    neighborhood: 'Centro',
    city: 'Piumhi',
    state: 'MG',
    latitude: -20.4739,
    longitude: -45.9583,
    precision: GEOCODE_PRECISION.CITY,
  },
}

function fixtureFor(cep: string): SeedAddressFixture | undefined {
  return SEED_ADDRESS_FIXTURES[cep.replace(/\D/g, '')]
}

/** Endereço fixo por CEP — nunca chama a rede, ao contrário de `ViaCepAddressLookupProvider`. */
export class SeedAddressLookupProvider implements AddressLookupProviderInterface {
  async lookupByCep(cep: string): Promise<AddressLookupResult | undefined> {
    const fixture = fixtureFor(cep)
    if (!fixture) return undefined
    const { street, neighborhood, city, state } = fixture
    return { street, neighborhood, city, state }
  }
}

/** Coordenada fixa por CEP — nunca chama a rede, ao contrário de `NominatimGeocodingProvider`. */
export class SeedGeocodingProvider implements GeocodingProviderInterface {
  async geocodeByCep(cep: string): Promise<GeocodeOutcome> {
    const fixture = fixtureFor(cep)
    if (!fixture) return { kind: GEOCODE_OUTCOME_KIND.NOT_FOUND }

    return {
      kind: GEOCODE_OUTCOME_KIND.FOUND,
      coordinate: {
        latitude: fixture.latitude,
        longitude: fixture.longitude,
        precision: fixture.precision,
        provider: PROVIDER_NAME,
      },
    }
  }
}
