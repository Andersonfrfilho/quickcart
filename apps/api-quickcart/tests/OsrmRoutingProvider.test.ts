/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Sem rede real: `fetch` é substituído por um dublê em cada teste. O que importa provar é que o
 * provedor nunca lança e que distingue rota utilizável de resposta malformada/erro transitório.
 */

import { afterEach, describe, expect, it } from 'bun:test'
import { OsrmRoutingProvider } from '@/infra/osrm/OsrmRoutingProvider'
import { ROUTE_OUTCOME_KIND } from '@/modules/shared/address/RoutingProvider.interface'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

const FROM = { latitude: -20.5681587, longitude: -47.3593474 }
const TO = { latitude: -20.55, longitude: -47.39 }

function stubFetch(body: unknown, ok = true, status = 200): void {
  globalThis.fetch = (async () => ({ ok, status, json: async () => body })) as unknown as typeof fetch
}

describe('OsrmRoutingProvider', () => {
  it('rota válida mapeia distância (m→km) e duração (s→min)', async () => {
    stubFetch({ code: 'Ok', routes: [{ distance: 7910, duration: 720 }] })

    const outcome = await new OsrmRoutingProvider().getRoute({ from: FROM, to: TO })

    expect(outcome.kind).toBe(ROUTE_OUTCOME_KIND.FOUND)
    if (outcome.kind === ROUTE_OUTCOME_KIND.FOUND) {
      expect(outcome.route.distanceKm).toBeCloseTo(7.91, 6)
      expect(outcome.route.durationMinutes).toBeCloseTo(12, 6)
    }
  })

  it('sem rota (lista vazia) é unusable', async () => {
    stubFetch({ code: 'Ok', routes: [] })
    expect((await new OsrmRoutingProvider().getRoute({ from: FROM, to: TO })).kind).toBe(ROUTE_OUTCOME_KIND.UNUSABLE)
  })

  it('code diferente de Ok é unusable', async () => {
    stubFetch({ code: 'NoRoute', routes: [] })
    expect((await new OsrmRoutingProvider().getRoute({ from: FROM, to: TO })).kind).toBe(ROUTE_OUTCOME_KIND.UNUSABLE)
  })

  it('campo distance/duration ausente ou não numérico é unusable', async () => {
    stubFetch({ code: 'Ok', routes: [{ distance: 'não-é-número', duration: 720 }] })
    expect((await new OsrmRoutingProvider().getRoute({ from: FROM, to: TO })).kind).toBe(ROUTE_OUTCOME_KIND.UNUSABLE)
  })

  it('429/5xx são transient_error', async () => {
    stubFetch({}, false, 429)
    expect((await new OsrmRoutingProvider().getRoute({ from: FROM, to: TO })).kind).toBe(ROUTE_OUTCOME_KIND.TRANSIENT_ERROR)

    stubFetch({}, false, 503)
    expect((await new OsrmRoutingProvider().getRoute({ from: FROM, to: TO })).kind).toBe(ROUTE_OUTCOME_KIND.TRANSIENT_ERROR)
  })

  it('400 é unusable, não transitório', async () => {
    stubFetch({}, false, 400)
    expect((await new OsrmRoutingProvider().getRoute({ from: FROM, to: TO })).kind).toBe(ROUTE_OUTCOME_KIND.UNUSABLE)
  })

  it('timeout/erro de rede nunca lança — vira transient_error', async () => {
    globalThis.fetch = (async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError')
    }) as unknown as typeof fetch

    const outcome = await new OsrmRoutingProvider().getRoute({ from: FROM, to: TO })
    expect(outcome.kind).toBe(ROUTE_OUTCOME_KIND.TRANSIENT_ERROR)
  })

  it('manda AbortSignal de timeout no fetch', async () => {
    let receivedSignal: AbortSignal | undefined
    globalThis.fetch = (async (_url: string, init?: { signal?: AbortSignal }) => {
      receivedSignal = init?.signal
      return { ok: true, status: 200, json: async () => ({ code: 'Ok', routes: [{ distance: 100, duration: 10 }] }) }
    }) as unknown as typeof fetch

    await new OsrmRoutingProvider().getRoute({ from: FROM, to: TO })
    expect(receivedSignal).toBeInstanceOf(AbortSignal)
  })
})
