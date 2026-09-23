/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * `geocodeByAddress`: busca ESTRUTURADA (street/city/state), não `postalcode=`. Precisão sempre
 * `street` quando encontra — é o que remove a confirmação de "faixa máxima" para endereços que o
 * Nominatim consegue localizar pela rua.
 */

import { afterEach, describe, expect, it } from 'bun:test'
import { GEOCODE_PRECISION } from '@/modules/shared/address/Address.schema'
import {
  MAX_PENDING_GEOCODE_CALLS,
  MIN_INTERVAL_BETWEEN_CALLS_MS,
  NominatimGeocodingProvider,
} from '@/infra/nominatim/NominatimGeocodingProvider'
import { GEOCODE_OUTCOME_KIND } from '@/modules/shared/address/GeocodingProvider.interface'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

const ADDRESS = { street: 'Rua Radialista Alfeu Stabelini', city: 'Franca', state: 'SP' }

function stubFetch(body: unknown, calls: string[] = []): void {
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url))
    return { ok: true, json: async () => body }
  }) as unknown as typeof fetch
}

describe('NominatimGeocodingProvider — geocodeByAddress (busca estruturada)', () => {
  it('hit da busca estruturada devolve precisão street', async () => {
    stubFetch([{ lat: '-20.5681587', lon: '-47.3593474' }])
    const provider = new NominatimGeocodingProvider({ now: () => 0, sleep: async () => {} })

    const outcome = await provider.geocodeByAddress(ADDRESS)

    expect(outcome.kind).toBe(GEOCODE_OUTCOME_KIND.FOUND)
    if (outcome.kind === GEOCODE_OUTCOME_KIND.FOUND) {
      expect(outcome.coordinate.latitude).toBeCloseTo(-20.5681587, 6)
      expect(outcome.coordinate.longitude).toBeCloseTo(-47.3593474, 6)
      expect(outcome.coordinate.precision).toBe(GEOCODE_PRECISION.STREET)
      expect(outcome.coordinate.provider).toBe('nominatim-street')
    }
  })

  it('manda street/city/state e countrycodes=br na URL, não postalcode', async () => {
    const calls: string[] = []
    stubFetch([{ lat: '-20.5', lon: '-47.3' }], calls)
    const provider = new NominatimGeocodingProvider({ now: () => 0, sleep: async () => {} })

    await provider.geocodeByAddress(ADDRESS)

    expect(calls[0]).toContain('street=Rua')
    expect(calls[0]).toContain('city=Franca')
    expect(calls[0]).toContain('state=SP')
    expect(calls[0]).toContain('countrycodes=br')
    expect(calls[0]).not.toContain('postalcode=')
  })

  it('endereço incompleto é not_found sem chamar o fetch', async () => {
    const calls: string[] = []
    stubFetch([], calls)
    const provider = new NominatimGeocodingProvider({ now: () => 0, sleep: async () => {} })

    const outcome = await provider.geocodeByAddress({ street: '', city: 'Franca', state: 'SP' })

    expect(outcome).toEqual({ kind: GEOCODE_OUTCOME_KIND.NOT_FOUND })
    expect(calls).toEqual([])
  })

  it('lista vazia é not_found', async () => {
    stubFetch([])
    const provider = new NominatimGeocodingProvider({ now: () => 0, sleep: async () => {} })

    expect(await provider.geocodeByAddress(ADDRESS)).toEqual({ kind: GEOCODE_OUTCOME_KIND.NOT_FOUND })
  })

  it('429/5xx é transient_error; 400 é not_found', async () => {
    const provider = new NominatimGeocodingProvider({ now: () => 0, sleep: async () => {} })
    const stubStatus = (status: number): void => {
      globalThis.fetch = (async () => ({ ok: false, status, json: async () => [] })) as unknown as typeof fetch
    }

    stubStatus(429)
    expect((await provider.geocodeByAddress(ADDRESS)).kind).toBe(GEOCODE_OUTCOME_KIND.TRANSIENT_ERROR)
    stubStatus(503)
    expect((await provider.geocodeByAddress(ADDRESS)).kind).toBe(GEOCODE_OUTCOME_KIND.TRANSIENT_ERROR)
    stubStatus(400)
    expect((await provider.geocodeByAddress(ADDRESS)).kind).toBe(GEOCODE_OUTCOME_KIND.NOT_FOUND)
  })

  it('timeout vira transient_error', async () => {
    globalThis.fetch = (async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError')
    }) as unknown as typeof fetch
    const provider = new NominatimGeocodingProvider({ now: () => 0, sleep: async () => {} })

    expect((await provider.geocodeByAddress(ADDRESS)).kind).toBe(GEOCODE_OUTCOME_KIND.TRANSIENT_ERROR)
  })

  it('compartilha a fila de 1 req/s com geocodeByCep — chamadas simultâneas saem espaçadas', async () => {
    const fetchTimes: number[] = []
    let clock = 1000
    globalThis.fetch = (async () => {
      fetchTimes.push(clock)
      return { ok: true, json: async () => [{ lat: '-20.5', lon: '-47.3', address: { city: 'Franca' } }] }
    }) as unknown as typeof fetch

    const startedAt = clock
    const provider = new NominatimGeocodingProvider({
      now: () => clock,
      sleep: async (ms: number) => {
        await new Promise((resolve) => setTimeout(resolve, ms / 100))
        clock = Math.max(clock, startedAt + ms)
      },
    })

    await Promise.all([provider.geocodeByCep('14403-000'), provider.geocodeByAddress(ADDRESS)])

    expect(fetchTimes).toEqual([startedAt, startedAt + MIN_INTERVAL_BETWEEN_CALLS_MS])
  })

  it('fila cheia falha rápido como transitório, sem chamar o fetch', async () => {
    let fetchCount = 0
    globalThis.fetch = (async () => {
      fetchCount += 1
      return { ok: true, json: async () => [] }
    }) as unknown as typeof fetch

    let releaseSleep: () => void = () => {}
    const blocked = new Promise<void>((resolve) => {
      releaseSleep = resolve
    })
    const provider = new NominatimGeocodingProvider({ now: () => 0, sleep: () => blocked })

    const queued = Array.from({ length: MAX_PENDING_GEOCODE_CALLS }, () => provider.geocodeByCep('01310-100'))
    const overflow = await provider.geocodeByAddress(ADDRESS)

    expect(overflow).toEqual({ kind: GEOCODE_OUTCOME_KIND.TRANSIENT_ERROR })
    releaseSleep()
    await Promise.all(queued)
    expect(fetchCount).toBe(MAX_PENDING_GEOCODE_CALLS)
  })
})
