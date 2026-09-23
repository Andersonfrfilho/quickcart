/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Distância e duração pelo servidor de demonstração público do OSRM (`router.project-osrm.org`):
 * uma tentativa, timeout curto, nunca lança. Sem SLA documentado, então uma falha aqui é dado
 * esperado, não exceção — o chamador (`ResolveRoadRoute.use-case.ts`) decide o fallback de linha reta.
 */

import {
  ROUTE_OUTCOME_KIND,
  type RouteOutcome,
  type RouteQuery,
  type RoutingProviderInterface,
} from '@/modules/shared/address/RoutingProvider.interface'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'
import { OSRM_BASE_URL, OSRM_REQUEST_TIMEOUT_MS } from '@/infra/osrm/osrm.constant'

const osrmLog = logger.child('OsrmRoutingProvider')

const UNUSABLE: RouteOutcome = { kind: ROUTE_OUTCOME_KIND.UNUSABLE }
const TRANSIENT_ERROR: RouteOutcome = { kind: ROUTE_OUTCOME_KIND.TRANSIENT_ERROR }

const METERS_PER_KM = 1000
const SECONDS_PER_MINUTE = 60
const OSRM_SUCCESS_CODE = 'Ok'

type OsrmRoute = {
  readonly distance?: number
  readonly duration?: number
}

type OsrmResponse = {
  readonly code?: string
  readonly routes?: readonly OsrmRoute[]
}

export class OsrmRoutingProvider implements RoutingProviderInterface {
  async getRoute(params: RouteQuery): Promise<RouteOutcome> {
    const url = `${OSRM_BASE_URL}/${params.from.longitude},${params.from.latitude};${params.to.longitude},${params.to.latitude}?overview=false`

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(OSRM_REQUEST_TIMEOUT_MS) })
      if (!response.ok) {
        osrmLog.warn('route_http_error', { status: response.status })
        const isTransient = response.status === 429 || response.status >= 500
        return isTransient ? TRANSIENT_ERROR : UNUSABLE
      }

      const body = (await response.json()) as OsrmResponse
      const route = body.routes?.[0]
      const distanceMeters = route?.distance
      const durationSeconds = route?.duration
      if (
        body.code !== OSRM_SUCCESS_CODE ||
        typeof distanceMeters !== 'number' ||
        typeof durationSeconds !== 'number' ||
        !Number.isFinite(distanceMeters) ||
        !Number.isFinite(durationSeconds)
      ) {
        return UNUSABLE
      }

      return {
        kind: ROUTE_OUTCOME_KIND.FOUND,
        route: {
          distanceKm: distanceMeters / METERS_PER_KM,
          durationMinutes: durationSeconds / SECONDS_PER_MINUTE,
        },
      }
    } catch (error: unknown) {
      osrmLog.warn('route_failed', { error: serializeError(error) })
      return TRANSIENT_ERROR
    }
  }
}
