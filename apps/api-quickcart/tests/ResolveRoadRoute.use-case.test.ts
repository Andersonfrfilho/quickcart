/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { describe, expect, it } from 'bun:test'
import { ResolveRoadRouteUseCase } from '@/modules/shared/address/ResolveRoadRoute.use-case'
import { ROUTE_OUTCOME_KIND, type RouteOutcome, type RouteQuery, type RoutingProviderInterface } from '@/modules/shared/address/RoutingProvider.interface'

const FROM = { latitude: -20.5681587, longitude: -47.3593474 }
const TO = { latitude: -20.5681587, longitude: -47.4 } // mesmo meridiano de latitude, mais longe em longitude

function stubRoutingProvider(outcome: RouteOutcome): RoutingProviderInterface {
  return { async getRoute(_params: RouteQuery): Promise<RouteOutcome> { return outcome } }
}

describe('ResolveRoadRouteUseCase', () => {
  it('rota encontrada é a fonte primária de distância e duração', async () => {
    const useCase = new ResolveRoadRouteUseCase({
      routingProvider: stubRoutingProvider({
        kind: ROUTE_OUTCOME_KIND.FOUND,
        route: { distanceKm: 7.91, durationMinutes: 12 },
      }),
      detourFactor: 1.35,
    })

    const result = await useCase.execute({ from: FROM, to: TO })

    expect(result).toEqual({ distanceKm: 7.91, durationMinutes: 12, isRouted: true })
  })

  it('rota unusable cai para linha reta × fator de desvio, igual ao comportamento de hoje', async () => {
    const useCase = new ResolveRoadRouteUseCase({
      routingProvider: stubRoutingProvider({ kind: ROUTE_OUTCOME_KIND.UNUSABLE }),
      detourFactor: 1,
    })

    const result = await useCase.execute({ from: FROM, to: FROM })

    expect(result).toEqual({ distanceKm: 0, isRouted: false })
  })

  it('rota transient_error também cai para linha reta × fator — indistinguível de unusable para o chamador', async () => {
    const useCase = new ResolveRoadRouteUseCase({
      routingProvider: stubRoutingProvider({ kind: ROUTE_OUTCOME_KIND.TRANSIENT_ERROR }),
      detourFactor: 1,
    })

    const result = await useCase.execute({ from: FROM, to: FROM })

    expect(result).toEqual({ distanceKm: 0, isRouted: false })
  })
})
