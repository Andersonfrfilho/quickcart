/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Distância e duração de uma rota real entre dois pontos — separado de `GeocodingProviderInterface`
 * porque resolve um problema diferente: coordenada de um CEP não é caminho entre dois CEPs. Medido à
 * mão contra o OSRM (loja ↔ cliente reais em Franca-SP): a rota via ruas devolve 7,91 km / 12 min,
 * enquanto a linha reta × fator de desvio chega a 8,25 km — o suficiente para mudar a faixa de
 * entrega, não só o número mostrado.
 */

import type { Coordinate } from '@/modules/shared/address/haversine'

export type RouteResult = {
  readonly distanceKm: number
  readonly durationMinutes: number
}

export const ROUTE_OUTCOME_KIND = {
  FOUND: 'found',
  /** Resposta chegou, mas sem rota utilizável (código de erro, lista vazia, campo ausente). */
  UNUSABLE: 'unusable',
  /** Rede, timeout, 429/5xx: não diz nada sobre a rota, então não deve ser tratado como "sem rota". */
  TRANSIENT_ERROR: 'transient_error',
} as const

export type RouteOutcome =
  | { readonly kind: typeof ROUTE_OUTCOME_KIND.FOUND; readonly route: RouteResult }
  | { readonly kind: typeof ROUTE_OUTCOME_KIND.UNUSABLE }
  | { readonly kind: typeof ROUTE_OUTCOME_KIND.TRANSIENT_ERROR }

export type RouteQuery = {
  readonly from: Coordinate
  readonly to: Coordinate
}

export interface RoutingProviderInterface {
  /** Nunca lança; UNUSABLE e TRANSIENT_ERROR viram fallback de linha reta no chamador, sem distinção. */
  getRoute(params: RouteQuery): Promise<RouteOutcome>
}
