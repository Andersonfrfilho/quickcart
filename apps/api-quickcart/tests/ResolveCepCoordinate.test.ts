/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O critério de aceite da spec §9 que este arquivo existe para provar: "segundo pedido do mesmo CEP
 * não chama API externa". É o que sustenta usar o Nominatim (1 req/s, uso em massa proibido) sem
 * perder o acesso.
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
import { GEOCODE_FAILURE_TTL_MS, ResolveCepCoordinateUseCase } from '@/modules/shared/address/ResolveCepCoordinate.use-case'
import type {
  GeocodeFailureRecord,
  GeocodeFailureRepositoryInterface,
} from '@/modules/shared/address/GeocodeFailureRepository.interface'

class FakeGeocodedAddressRepository implements GeocodedAddressRepositoryInterface {
  readonly rows = new Map<string, GeocodedAddressRecord>()
  saveCount = 0
  saveShouldFail = false

  async findByCep(cep: string): Promise<GeocodedAddressRecord | undefined> {
    return this.rows.get(cep.replace(/\D/g, ''))
  }

  async save(params: SaveGeocodedAddressParams): Promise<void> {
    this.saveCount += 1
    if (this.saveShouldFail) throw new Error('banco fora')
    this.rows.set(params.cep.replace(/\D/g, ''), {
      ...params,
      resolvedAt: new Date(),
    })
  }
}

class SpyGeocodingProvider implements GeocodingProviderInterface {
  callCount = 0
  constructor(private readonly result: GeocodeResult | undefined) {}

  async geocodeByCep(): Promise<GeocodeResult | undefined> {
    this.callCount += 1
    return this.result
  }
}

class FakeGeocodeFailureRepository implements GeocodeFailureRepositoryInterface {
  readonly rows = new Map<string, GeocodeFailureRecord>()
  removeCalls: string[] = []

  async findByCep(cep: string): Promise<GeocodeFailureRecord | undefined> {
    return this.rows.get(cep.replace(/\D/g, ''))
  }

  async save(params: { readonly cep: string; readonly failedAt: Date }): Promise<void> {
    this.rows.set(params.cep.replace(/\D/g, ''), { cep: params.cep, failedAt: params.failedAt })
  }

  async remove(cep: string): Promise<void> {
    this.removeCalls.push(cep)
    this.rows.delete(cep.replace(/\D/g, ''))
  }
}

const COORDINATE: GeocodeResult = {
  latitude: -23.5649659,
  longitude: -46.6518144,
  precision: GEOCODE_PRECISION.POSTAL_CODE,
  provider: 'nominatim',
}

describe('ResolveCepCoordinateUseCase', () => {
  it('geocodifica no primeiro pedido e serve o segundo do cache, sem chamada externa', async () => {
    const geocodedAddressRepository = new FakeGeocodedAddressRepository()
    const geocodingProvider = new SpyGeocodingProvider(COORDINATE)
    const useCase = new ResolveCepCoordinateUseCase({ geocodedAddressRepository, geocodingProvider })

    const first = await useCase.execute({ cep: '01310-100' })
    const second = await useCase.execute({ cep: '01310-100' })

    expect(geocodingProvider.callCount).toBe(1)
    expect(first?.fromCache).toBe(false)
    expect(second?.fromCache).toBe(true)
    expect(second?.latitude).toBe(COORDINATE.latitude)
    expect(second?.precision).toBe(GEOCODE_PRECISION.POSTAL_CODE)
  })

  it('trata o mesmo CEP com e sem hífen como um só — senão o cache nunca acerta', async () => {
    const geocodedAddressRepository = new FakeGeocodedAddressRepository()
    const geocodingProvider = new SpyGeocodingProvider(COORDINATE)
    const useCase = new ResolveCepCoordinateUseCase({ geocodedAddressRepository, geocodingProvider })

    await useCase.execute({ cep: '01310-100' })
    const second = await useCase.execute({ cep: '01310100' })

    expect(geocodingProvider.callCount).toBe(1)
    expect(second?.fromCache).toBe(true)
  })

  it('devolve undefined quando o provedor não resolve, sem gravar nada no cache', async () => {
    // Cachear "não achei" faria um CEP novo (bairro recém-criado, ou erro temporário do provedor)
    // ficar permanentemente sem coordenada.
    const geocodedAddressRepository = new FakeGeocodedAddressRepository()
    const geocodingProvider = new SpyGeocodingProvider(undefined)
    const useCase = new ResolveCepCoordinateUseCase({ geocodedAddressRepository, geocodingProvider })

    expect(await useCase.execute({ cep: '99999-999' })).toBeUndefined()
    expect(geocodedAddressRepository.saveCount).toBe(0)
  })

  it('não chama o provedor para CEP que nem tem 8 dígitos', async () => {
    const geocodingProvider = new SpyGeocodingProvider(COORDINATE)
    const useCase = new ResolveCepCoordinateUseCase({
      geocodedAddressRepository: new FakeGeocodedAddressRepository(),
      geocodingProvider,
    })

    expect(await useCase.execute({ cep: '123' })).toBeUndefined()
    expect(geocodingProvider.callCount).toBe(0)
  })

  it('devolve a coordenada mesmo se gravar no cache falhar', async () => {
    // A coordenada já serve para ESTE pedido; falhar em cachear só custa outra chamada no próximo.
    const geocodedAddressRepository = new FakeGeocodedAddressRepository()
    geocodedAddressRepository.saveShouldFail = true
    const useCase = new ResolveCepCoordinateUseCase({
      geocodedAddressRepository,
      geocodingProvider: new SpyGeocodingProvider(COORDINATE),
    })

    const result = await useCase.execute({ cep: '01310-100' })

    expect(result?.latitude).toBe(COORDINATE.latitude)
    expect(result?.fromCache).toBe(false)
  })

  it('CEP com falha recente (< 24h): não chama o provedor de novo', async () => {
    const geocodeFailureRepository = new FakeGeocodeFailureRepository()
    let now = new Date('2026-09-22T12:00:00.000Z')
    await geocodeFailureRepository.save({ cep: '01310100', failedAt: now })

    const geocodingProvider = new SpyGeocodingProvider(COORDINATE)
    const useCase = new ResolveCepCoordinateUseCase({
      geocodedAddressRepository: new FakeGeocodedAddressRepository(),
      geocodingProvider,
      geocodeFailureRepository,
      now: () => now,
    })

    now = new Date(now.getTime() + GEOCODE_FAILURE_TTL_MS - 1000) // 23h59min depois
    const result = await useCase.execute({ cep: '01310-100' })

    expect(result).toBeUndefined()
    expect(geocodingProvider.callCount).toBe(0)
  })

  it('CEP com falha há mais de 24h: chama o provedor de novo', async () => {
    const geocodeFailureRepository = new FakeGeocodeFailureRepository()
    let now = new Date('2026-09-22T12:00:00.000Z')
    await geocodeFailureRepository.save({ cep: '01310100', failedAt: now })

    const geocodingProvider = new SpyGeocodingProvider(COORDINATE)
    const useCase = new ResolveCepCoordinateUseCase({
      geocodedAddressRepository: new FakeGeocodedAddressRepository(),
      geocodingProvider,
      geocodeFailureRepository,
      now: () => now,
    })

    now = new Date(now.getTime() + GEOCODE_FAILURE_TTL_MS + 1000) // 24h01min depois
    const result = await useCase.execute({ cep: '01310-100' })

    expect(geocodingProvider.callCount).toBe(1)
    expect(result?.latitude).toBe(COORDINATE.latitude)
  })

  it('grava a falha quando o provedor não resolve, e remove ao resolver depois', async () => {
    const geocodeFailureRepository = new FakeGeocodeFailureRepository()
    const geocodingProvider = new SpyGeocodingProvider(undefined)
    const useCase = new ResolveCepCoordinateUseCase({
      geocodedAddressRepository: new FakeGeocodedAddressRepository(),
      geocodingProvider,
      geocodeFailureRepository,
    })

    const failed = await useCase.execute({ cep: '01310-100' })
    expect(failed).toBeUndefined()
    expect(geocodeFailureRepository.rows.has('01310100')).toBe(true)
  })

  it('sucesso posterior remove a falha registrada', async () => {
    const geocodeFailureRepository = new FakeGeocodeFailureRepository()
    await geocodeFailureRepository.save({ cep: '01310100', failedAt: new Date('2020-01-01') })

    const useCase = new ResolveCepCoordinateUseCase({
      geocodedAddressRepository: new FakeGeocodedAddressRepository(),
      geocodingProvider: new SpyGeocodingProvider(COORDINATE),
      geocodeFailureRepository,
      now: () => new Date('2026-09-22T12:00:00.000Z'), // muito depois da janela de 24h, já cairia
    })

    const result = await useCase.execute({ cep: '01310-100' })

    expect(result?.latitude).toBe(COORDINATE.latitude)
    expect(geocodeFailureRepository.removeCalls).toEqual(['01310100'])
    expect(geocodeFailureRepository.rows.has('01310100')).toBe(false)
  })
})
