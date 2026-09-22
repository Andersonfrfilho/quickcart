/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A cotação por faixa: cada `kind`, os limites da faixa e os motivos de não entregar.
 * Loja em (0, 0) e cliente no mesmo meridiano, com fator de desvio 1 — a distância sai cravada.
 */

import { describe, expect, it } from 'bun:test'
import type {
  DeliveryFeeTier,
  DeliveryFeeTierRepositoryInterface,
} from '@/modules/order/domain/DeliveryFeeTierRepository.interface'
import { QuoteDeliveryFeeUseCase } from '@/modules/order/application/use-cases/QuoteDeliveryFee.use-case'
import type { CustomerLocation } from '@/modules/order/application/types/QuoteDeliveryFee.types'
import { GEOCODE_PRECISION } from '@/modules/shared/address/Address.schema'
import type { ResolveCepCoordinateUseCase, ResolvedCoordinate } from '@/modules/shared/address/ResolveCepCoordinate.use-case'

const STORE_CEP = '01415000'
const NEAR_CEP = '01310100'
const CITY_CEP = '37925000'
const UNKNOWN_CEP = '99999999'
const TIERS: readonly DeliveryFeeTier[] = [
  { maxDistanceKm: 3, feeInCents: 500 },
  { maxDistanceKm: 8, feeInCents: 1000 },
]
const KM_PER_DEGREE = (Math.PI * 6371) / 180

function latitudeAtKm(distanceKm: number): number {
  return distanceKm / KM_PER_DEGREE
}

function coordinatesAtKm(distanceKm: number): CustomerLocation {
  return { kind: 'coordinates', latitude: latitudeAtKm(distanceKm), longitude: 0 }
}

const COORDINATES: Readonly<Record<string, ResolvedCoordinate>> = {
  [STORE_CEP]: { latitude: 0, longitude: 0, precision: GEOCODE_PRECISION.POSTAL_CODE, fromCache: true },
  [NEAR_CEP]: { latitude: latitudeAtKm(2), longitude: 0, precision: GEOCODE_PRECISION.STREET, fromCache: true },
  [CITY_CEP]: { latitude: latitudeAtKm(1), longitude: 0, precision: GEOCODE_PRECISION.CITY, fromCache: true },
}

class FakeResolveCepCoordinate implements Pick<ResolveCepCoordinateUseCase, 'execute'> {
  readonly calls: string[] = []

  async execute(params: { readonly cep: string }): Promise<ResolvedCoordinate | undefined> {
    this.calls.push(params.cep)
    return COORDINATES[params.cep]
  }
}

class FakeTierRepository implements DeliveryFeeTierRepositoryInterface {
  constructor(private readonly tiers: readonly DeliveryFeeTier[]) {}

  async listOrdered(): Promise<readonly DeliveryFeeTier[]> {
    return this.tiers
  }

  async replaceAll(): Promise<void> {
    throw new Error('not used in this test')
  }
}

function buildUseCase(overrides: { readonly tiers?: readonly DeliveryFeeTier[]; readonly storeCep?: string | undefined } = {}) {
  const resolveCepCoordinateUseCase = new FakeResolveCepCoordinate()
  const useCase = new QuoteDeliveryFeeUseCase({
    deliveryFeeTierRepository: new FakeTierRepository(overrides.tiers ?? TIERS),
    resolveCepCoordinateUseCase,
    storeCep: 'storeCep' in overrides ? overrides.storeCep : STORE_CEP,
    detourFactor: 1,
  })
  return { useCase, resolveCepCoordinateUseCase }
}

describe('QuoteDeliveryFeeUseCase', () => {
  it('retirada cobra 0 e não geocodifica nada', async () => {
    const { useCase, resolveCepCoordinateUseCase } = buildUseCase()
    const result = await useCase.execute({ deliveryType: 'pickup', location: { kind: 'cep', cep: NEAR_CEP } })
    expect(result).toEqual({ kind: 'pickup', feeInCents: 0 })
    expect(resolveCepCoordinateUseCase.calls).toEqual([])
  })

  it('coordenada a ~2 km cai na primeira faixa, com fonte whatsapp_location', async () => {
    const { useCase } = buildUseCase()
    const result = await useCase.execute({ deliveryType: 'delivery', location: coordinatesAtKm(2) })
    expect(result).toMatchObject({ kind: 'quoted', feeInCents: 500, tier: TIERS[0], source: 'whatsapp_location' })
    if (result.kind === 'quoted') expect(result.distanceKm).toBeCloseTo(2, 6)
  })

  it('exatamente no limite de 3,00 km ainda é a primeira faixa', async () => {
    const { useCase } = buildUseCase()
    const result = await useCase.execute({ deliveryType: 'delivery', location: coordinatesAtKm(3) })
    expect(result).toMatchObject({ kind: 'quoted', feeInCents: 500 })
  })

  it('~6 km cai na segunda faixa', async () => {
    const { useCase } = buildUseCase()
    const result = await useCase.execute({ deliveryType: 'delivery', location: coordinatesAtKm(6) })
    expect(result).toMatchObject({ kind: 'quoted', feeInCents: 1000, tier: TIERS[1] })
  })

  it('~12 km fica fora do raio da última faixa', async () => {
    const { useCase } = buildUseCase()
    const result = await useCase.execute({ deliveryType: 'delivery', location: coordinatesAtKm(12) })
    expect(result).toMatchObject({ kind: 'out_of_range', maxDistanceKm: 8 })
    if (result.kind === 'out_of_range') expect(result.distanceKm).toBeCloseTo(12, 6)
  })

  it('reordena faixas que chegam fora de ordem', async () => {
    const { useCase } = buildUseCase({ tiers: [...TIERS].reverse() })
    const result = await useCase.execute({ deliveryType: 'delivery', location: coordinatesAtKm(2) })
    expect(result).toMatchObject({ kind: 'quoted', feeInCents: 500 })
  })

  it('CEP de precisão exata cota pela distância, com fonte cep', async () => {
    const { useCase } = buildUseCase()
    const result = await useCase.execute({ deliveryType: 'delivery', location: { kind: 'cep', cep: NEAR_CEP } })
    expect(result).toMatchObject({ kind: 'quoted', feeInCents: 500, source: 'cep' })
  })

  it('CEP de precisão cidade cobra a maior faixa (D3)', async () => {
    const { useCase } = buildUseCase()
    const result = await useCase.execute({ deliveryType: 'delivery', location: { kind: 'cep', cep: CITY_CEP } })
    expect(result).toEqual({ kind: 'approximate_max_tier', feeInCents: 1000, tier: TIERS[1], source: 'cep_approximate' })
  })

  it('sem faixas não entrega', async () => {
    const { useCase } = buildUseCase({ tiers: [] })
    const result = await useCase.execute({ deliveryType: 'delivery', location: coordinatesAtKm(2) })
    expect(result).toEqual({ kind: 'unavailable', reason: 'no_tiers' })
  })

  it('sem CEP da loja não entrega', async () => {
    const { useCase } = buildUseCase({ storeCep: undefined })
    const result = await useCase.execute({ deliveryType: 'delivery', location: coordinatesAtKm(2) })
    expect(result).toEqual({ kind: 'unavailable', reason: 'no_store_cep' })
  })

  it('sem localização do cliente não entrega', async () => {
    const { useCase } = buildUseCase()
    const result = await useCase.execute({ deliveryType: 'delivery' })
    expect(result).toEqual({ kind: 'unavailable', reason: 'no_customer_location' })
  })

  it('CEP sem coordenada é falha de geocodificação', async () => {
    const { useCase } = buildUseCase()
    const result = await useCase.execute({ deliveryType: 'delivery', location: { kind: 'cep', cep: UNKNOWN_CEP } })
    expect(result).toEqual({ kind: 'unavailable', reason: 'geocoding_failed' })
  })
})
