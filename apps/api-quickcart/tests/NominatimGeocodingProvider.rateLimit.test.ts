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
import { NominatimGeocodingProvider } from '@/infra/nominatim/NominatimGeocodingProvider'

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
  it('serializa duas chamadas concorrentes: a segunda só sai depois do intervalo mínimo', async () => {
    stubFetch()

    // Começa em 1000, não 0: `lastCallAt === 0` é o sinal interno de "nunca chamou" — com o relógio
    // de teste começando em 0, a primeira chamada real cairia no mesmo valor e mascararia a segunda
    // chamada como se também fosse a primeira.
    let clock = 1000
    const sleepCalls: number[] = []
    const provider = new NominatimGeocodingProvider({
      now: () => clock,
      sleep: async (ms: number) => {
        sleepCalls.push(ms)
        clock += ms
      },
    })

    await Promise.all([provider.geocodeByCep('01310-100'), provider.geocodeByCep('01415-000')])

    // A primeira chamada não espera (relógio em 0, nenhuma chamada anterior); a segunda, disparada
    // no "mesmo instante", precisa esperar o intervalo mínimo antes de seguir.
    expect(sleepCalls.length).toBe(1)
    expect(sleepCalls[0]).toBeGreaterThan(0)
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
})
