/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Ponto único de "distância entre loja e cliente": tenta a rota real primeiro, cai para linha reta
 * × fator de desvio quando o roteador falha ou não tem SLA (OSRM demo). O fallback é o cálculo de
 * sempre (`calculateRoadDistanceKm`) — uma falha do OSRM tem de degradar para o comportamento de
 * hoje, nunca quebrar a cotação.
 */

import { ROUTE_OUTCOME_KIND, type RoutingProviderInterface } from '@/modules/shared/address/RoutingProvider.interface'
import { calculateRoadDistanceKm } from '@/modules/shared/address/deliveryEstimate'
import type { Coordinate } from '@/modules/shared/address/haversine'

export type ResolvedRoadRoute = {
  readonly distanceKm: number
  /** Só presente quando a rota veio do roteador — o fallback de linha reta não tem duração real. */
  readonly durationMinutes?: number
  readonly isRouted: boolean
}

type ResolveRoadRouteDependencies = {
  readonly routingProvider: RoutingProviderInterface
  readonly detourFactor: number
}

export type ResolveRoadRouteParams = {
  readonly from: Coordinate
  readonly to: Coordinate
}

export class ResolveRoadRouteUseCase {
  constructor(private readonly dependencies: ResolveRoadRouteDependencies) {}

  async execute(params: ResolveRoadRouteParams): Promise<ResolvedRoadRoute> {
    const outcome = await this.dependencies.routingProvider.getRoute(params)

    if (outcome.kind === ROUTE_OUTCOME_KIND.FOUND) {
      return {
        distanceKm: outcome.route.distanceKm,
        durationMinutes: outcome.route.durationMinutes,
        isRouted: true,
      }
    }

    return {
      distanceKm: calculateRoadDistanceKm({
        from: params.from,
        to: params.to,
        detourFactor: this.dependencies.detourFactor,
      }),
      isRouted: false,
    }
  }
}
