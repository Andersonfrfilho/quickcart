/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Este arquivo é quase todo sobre os caminhos em que a resposta certa é NÃO RESPONDER. Cada
 * `undefined` aqui é uma tela que mostra o endereço e cala sobre distância, em vez de exibir um número
 * que o operador usaria para prometer horário ao cliente.
 */

import { describe, expect, it } from 'bun:test'
import { GEOCODE_PRECISION } from '@/modules/shared/address/Address.schema'
import type {
  GeocodedAddressRecord,
  GeocodedAddressRepositoryInterface,
  SaveGeocodedAddressParams,
} from '@/modules/shared/address/GeocodedAddressRepository.interface'
import type {
  GeocodeResult,
  GeocodingProviderInterface,
} from '@/modules/shared/address/GeocodingProvider.interface'
import { ResolveCepCoordinateUseCase } from '@/modules/shared/address/ResolveCepCoordinate.use-case'
import { ResolveOrderDeliveryEstimateUseCase } from '@/modules/order/application/use-cases/ResolveOrderDeliveryEstimate.use-case'
import type { OrderRecord } from '@/modules/order/domain/OrderRepository.interface'

/** Loja na Consolação, São Paulo. */
const STORE_CEP = '01415-000'

const COORDINATES: Record<string, GeocodeResult> = {
  // Loja.
  '01415000': {
    latitude: -23.5524469,
    longitude: -46.6558521,
    precision: GEOCODE_PRECISION.POSTAL_CODE,
    provider: 'nominatim',
  },
  // Bela Vista: ~1,5 km da loja em linha reta.
  '01310100': {
    latitude: -23.5649659,
    longitude: -46.6518144,
    precision: GEOCODE_PRECISION.POSTAL_CODE,
    provider: 'nominatim',
  },
  // Piumhi/MG: outro estado, e a coordenada é o centroide do município.
  '37925000': {
    latitude: -20.4742903,
    longitude: -45.9683809,
    precision: GEOCODE_PRECISION.CITY,
    provider: 'nominatim',
  },
}

class InMemoryGeocodedAddressRepository implements GeocodedAddressRepositoryInterface {
  private readonly rows = new Map<string, GeocodedAddressRecord>()

  async findByCep(cep: string): Promise<GeocodedAddressRecord | undefined> {
    return this.rows.get(cep.replace(/\D/g, ''))
  }

  async save(params: SaveGeocodedAddressParams): Promise<void> {
    this.rows.set(params.cep.replace(/\D/g, ''), { ...params, resolvedAt: new Date() })
  }
}

class MapGeocodingProvider implements GeocodingProviderInterface {
  async geocodeByCep(cep: string): Promise<GeocodeResult | undefined> {
    return COORDINATES[cep.replace(/\D/g, '')]
  }
}

function buildUseCase(overrides: { readonly storeCep?: string | undefined; readonly deliveryRadiusKm?: number } = {}) {
  return new ResolveOrderDeliveryEstimateUseCase({
    resolveCepCoordinateUseCase: new ResolveCepCoordinateUseCase({
      geocodedAddressRepository: new InMemoryGeocodedAddressRepository(),
      geocodingProvider: new MapGeocodingProvider(),
    }),
    storeCep: 'storeCep' in overrides ? overrides.storeCep : STORE_CEP,
    detourFactor: 1.35,
    averageSpeedKmh: 25,
    preparationMinutes: 20,
    deliveryRadiusKm: overrides.deliveryRadiusKm ?? 8,
  })
}

function buildOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: 'order-1',
    shortCode: 'QC-1000',
    customerId: 'customer-1',
    cartId: null,
    channel: 'web',
    status: 'preparing',
    totalInCents: 5000,
    deliveryType: 'delivery',
    address: {
      cep: '01310-100',
      street: 'Rua Bela Cintra',
      number: '412',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    },
    legacyAddressText: null,
    paymentMethod: 'pix',
    receiptPreference: 'whatsapp',
    fiscalDocumentId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('ResolveOrderDeliveryEstimateUseCase', () => {
  it('calcula distância e faixa de horário para entrega com endereço estruturado', async () => {
    const estimate = await buildUseCase().execute({ order: buildOrder() })

    expect(estimate).toBeDefined()
    // ~1,4 km em linha reta × 1,35 de desvio — ordem de grandeza, não número cravado.
    expect(estimate!.distanceKm).toBeGreaterThan(1)
    expect(estimate!.distanceKm).toBeLessThan(3)
    expect(estimate!.minMinutes).toBeDefined()
    expect(estimate!.maxMinutes).toBeGreaterThan(estimate!.minMinutes!)
    expect(estimate!.isApproximate).toBe(false)
    expect(estimate!.isOutsideRadius).toBe(false)
  })

  it('não calcula nada para retirada — o cliente vem até a loja', async () => {
    const estimate = await buildUseCase().execute({ order: buildOrder({ deliveryType: 'pickup' }) })
    expect(estimate).toBeUndefined()
  })

  it('não calcula nada sem STORE_CEP configurado', async () => {
    // A feature inteira é opt-in: loja que não configurou vê endereço, não distância.
    const estimate = await buildUseCase({ storeCep: undefined }).execute({ order: buildOrder() })
    expect(estimate).toBeUndefined()
  })

  it('não calcula nada para endereço legado em texto livre', async () => {
    // Não há CEP confiável em texto livre — a ADR 0001 é sobre exatamente isso.
    const estimate = await buildUseCase().execute({
      order: buildOrder({ address: 'manda na rua de trás do posto, portão verde' }),
    })
    expect(estimate).toBeUndefined()
  })

  it('não calcula nada quando o CEP do cliente não geocodifica', async () => {
    const estimate = await buildUseCase().execute({
      order: buildOrder({ address: { cep: '99999-999', street: 'Rua X', number: '1', neighborhood: 'Y', city: 'Z', state: 'SP' } }),
    })
    expect(estimate).toBeUndefined()
  })

  it('marca como aproximada e não promete horário quando o CEP do cliente é centroide de município', async () => {
    const estimate = await buildUseCase().execute({
      order: buildOrder({
        address: { cep: '37925-000', street: 'Rua Y', number: '10', neighborhood: 'Centro', city: 'Piumhi', state: 'MG' },
      }),
    })

    expect(estimate?.isApproximate).toBe(true)
    expect(estimate?.minMinutes).toBeUndefined()
    // Piumhi fica a centenas de km de São Paulo: precisa aparecer como fora do raio.
    expect(estimate?.isOutsideRadius).toBe(true)
  })

  it('avisa fora do raio sem impedir nada — a decisão é da pessoa (spec §8 Q2)', async () => {
    const apertado = await buildUseCase({ deliveryRadiusKm: 0.5 }).execute({ order: buildOrder() })

    expect(apertado?.isOutsideRadius).toBe(true)
    // O aviso não apaga a estimativa: quem decide atender ainda quer saber quanto tempo leva.
    expect(apertado?.minMinutes).toBeDefined()
  })
})
