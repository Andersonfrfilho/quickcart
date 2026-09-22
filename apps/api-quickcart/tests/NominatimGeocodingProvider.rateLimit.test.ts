/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Ritmo de 1 req/s ao Nominatim (T1.4, spec §3.5): a política de uso do provedor proíbe uso em
 * massa, e duas cotações simultâneas de CEPs diferentes não podem virar duas chamadas no mesmo
 * instante. `now`/`sleep` injetáveis provam a serialização sem esperar 1,1s de verdade por teste.
 */

import { afterEach, describe, expect, it } from 'bun:test'
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

function stubFetch(): void {
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => [{ lat: '-23.5', lon: '-46.6', address: { city: 'São Paulo' } }],
  })) as unknown as typeof fetch
}

describe('NominatimGeocodingProvider — ritmo de 1 req/s', () => {
  it('três chamadas simultâneas saem espaçadas pelo intervalo mínimo, cada uma no seu slot', async () => {
    const fetchTimes: number[] = []
    let clock = 1000
    globalThis.fetch = (async () => {
      fetchTimes.push(clock)
      return { ok: true, json: async () => [{ lat: '-23.5', lon: '-46.6', address: { city: 'São Paulo' } }] }
    }) as unknown as typeof fetch

    // Relógio que avança até o fim do sono mais longo já pedido — como o tempo real faria.
    const startedAt = clock
    const provider = new NominatimGeocodingProvider({
      now: () => clock,
      sleep: async (ms: number) => {
        await new Promise((resolve) => setTimeout(resolve, ms / 100))
        clock = Math.max(clock, startedAt + ms)
      },
    })

    await Promise.all([
      provider.geocodeByCep('01310-100'),
      provider.geocodeByCep('01415-000'),
      provider.geocodeByCep('37925-000'),
    ])

    expect(fetchTimes).toEqual([
      startedAt,
      startedAt + MIN_INTERVAL_BETWEEN_CALLS_MS,
      startedAt + 2 * MIN_INTERVAL_BETWEEN_CALLS_MS,
    ])
  })

  it('não espera quando a chamada anterior já passou do intervalo mínimo', async () => {
    stubFetch()

    let clock = 0
    const sleepCalls: number[] = []
    const provider = new NominatimGeocodingProvider({
      now: () => clock,
      sleep: async (ms: number) => {
        sleepCalls.push(ms)
        clock += ms
      },
    })

    await provider.geocodeByCep('01310-100')
    clock += 2000 // mais que 1,1s depois
    await provider.geocodeByCep('01415-000')

    expect(sleepCalls.length).toBe(0)
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
    const overflow = await provider.geocodeByCep('01415-000')

    expect(overflow).toEqual({ kind: GEOCODE_OUTCOME_KIND.TRANSIENT_ERROR })
    releaseSleep()
    await Promise.all(queued)
    expect(fetchCount).toBe(MAX_PENDING_GEOCODE_CALLS)
  })
})
