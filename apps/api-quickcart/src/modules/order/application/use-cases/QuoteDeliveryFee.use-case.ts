/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O único lugar que calcula taxa de entrega: bot, cotação web e criação de pedido consomem daqui.
 *
 * Nunca lança nos caminhos esperados — cada motivo de não entregar vira um `kind` que o chamador
 * transforma em mensagem ("retire na loja ou informe outro endereço"). Coordenada é dado pessoal e
 * não sai deste arquivo em log.
 */

import type {
  DeliveryFeeTier,
  DeliveryFeeTierRepositoryInterface,
} from '@/modules/order/domain/DeliveryFeeTierRepository.interface'
import type { QuoteDeliveryFeeParams, QuoteDeliveryFeeResult } from '@/modules/order/application/types/QuoteDeliveryFee.types'
import {
  CUSTOMER_LOCATION_KIND,
  DELIVERY_LOCATION_SOURCE,
  DELIVERY_QUOTE_KIND,
  DELIVERY_UNAVAILABLE_REASON,
  type DeliveryUnavailableReason,
} from '@/modules/order/shared/DeliveryFeeQuote.constant'
import { DELIVERY_TYPE } from '@/modules/order/shared/Order.constant'
import { GEOCODE_PRECISION } from '@/modules/shared/address/Address.schema'
import { calculateRoadDistanceKm } from '@/modules/shared/address/deliveryEstimate'
import type { Coordinate } from '@/modules/shared/address/haversine'
import { roundDistanceKm } from '@/shared/formatDistanceKm'
import type { ResolveCepCoordinateUseCase } from '@/modules/shared/address/ResolveCepCoordinate.use-case'
import type { ResolveRoadRouteUseCase } from '@/modules/shared/address/ResolveRoadRoute.use-case'

/** Centroide do município (ou nada): a distância seria da cidade, não da casa — cobra a maior faixa (D3). */
const APPROXIMATE_PRECISIONS: ReadonlySet<string> = new Set([GEOCODE_PRECISION.CITY, GEOCODE_PRECISION.NONE])

type QuoteDeliveryFeeDependencies = {
  readonly deliveryFeeTierRepository: DeliveryFeeTierRepositoryInterface
  readonly resolveCepCoordinateUseCase: Pick<ResolveCepCoordinateUseCase, 'execute'>
  readonly storeCep: string | undefined
  readonly detourFactor: number
  /** Ausente só em teste: sem ela, a distância volta a ser linha reta × fator — o comportamento de sempre. */
  readonly resolveRoadRouteUseCase?: Pick<ResolveRoadRouteUseCase, 'execute'>
}

type CustomerPoint = {
  readonly coordinate: Coordinate
  readonly isApproximate: boolean
  readonly source: typeof DELIVERY_LOCATION_SOURCE.WHATSAPP_LOCATION | typeof DELIVERY_LOCATION_SOURCE.CEP
}

function unavailable(reason: DeliveryUnavailableReason): QuoteDeliveryFeeResult {
  return { kind: DELIVERY_QUOTE_KIND.UNAVAILABLE, reason }
}

export class QuoteDeliveryFeeUseCase {
  constructor(private readonly dependencies: QuoteDeliveryFeeDependencies) {}

  async execute(params: QuoteDeliveryFeeParams): Promise<QuoteDeliveryFeeResult> {
    if (params.deliveryType === DELIVERY_TYPE.PICKUP) return { kind: DELIVERY_QUOTE_KIND.PICKUP, feeInCents: 0 }

    const tiers = [...(await this.dependencies.deliveryFeeTierRepository.listOrdered())].sort(
      (left, right) => left.maxDistanceKm - right.maxDistanceKm,
    )
    const largestTier = tiers.at(-1)
    if (!largestTier) return unavailable(DELIVERY_UNAVAILABLE_REASON.NO_TIERS)

    const storeCep = this.dependencies.storeCep
    if (!storeCep) return unavailable(DELIVERY_UNAVAILABLE_REASON.NO_STORE_CEP)
    if (!params.location) return unavailable(DELIVERY_UNAVAILABLE_REASON.NO_CUSTOMER_LOCATION)

    const [storeCoordinate, customerPoint] = await Promise.all([
      this.dependencies.resolveCepCoordinateUseCase.execute({ cep: storeCep }),
      this.resolveCustomerPoint(params.location),
    ])
    if (!storeCoordinate || !customerPoint) return unavailable(DELIVERY_UNAVAILABLE_REASON.GEOCODING_FAILED)

    if (customerPoint.isApproximate) {
      return {
        kind: DELIVERY_QUOTE_KIND.APPROXIMATE_MAX_TIER,
        feeInCents: largestTier.feeInCents,
        tier: largestTier,
        source: DELIVERY_LOCATION_SOURCE.CEP_APPROXIMATE,
      }
    }

    const route = this.dependencies.resolveRoadRouteUseCase
      ? await this.dependencies.resolveRoadRouteUseCase.execute({
          from: storeCoordinate,
          to: customerPoint.coordinate,
        })
      : {
          distanceKm: calculateRoadDistanceKm({
            from: storeCoordinate,
            to: customerPoint.coordinate,
            detourFactor: this.dependencies.detourFactor,
          }),
        }
    // Arredonda UMA vez, antes da faixa: 3,04 km é "3 km" na mensagem, então tem de cair na faixa "até 3 km".
    const distanceKm = roundDistanceKm(route.distanceKm)
    return this.quoteByDistance({ tiers, largestTier, distanceKm, source: customerPoint.source })
  }

  private quoteByDistance(params: {
    readonly tiers: readonly DeliveryFeeTier[]
    readonly largestTier: DeliveryFeeTier
    readonly distanceKm: number
    readonly source: CustomerPoint['source']
  }): QuoteDeliveryFeeResult {
    const tier = params.tiers.find((candidate) => candidate.maxDistanceKm >= params.distanceKm)
    if (!tier) {
      return {
        kind: DELIVERY_QUOTE_KIND.OUT_OF_RANGE,
        distanceKm: params.distanceKm,
        maxDistanceKm: params.largestTier.maxDistanceKm,
      }
    }
    return {
      kind: DELIVERY_QUOTE_KIND.QUOTED,
      feeInCents: tier.feeInCents,
      distanceKm: params.distanceKm,
      tier,
      source: params.source,
    }
  }

  private async resolveCustomerPoint(location: NonNullable<QuoteDeliveryFeeParams['location']>): Promise<CustomerPoint | undefined> {
    if (location.kind === CUSTOMER_LOCATION_KIND.COORDINATES) {
      return {
        coordinate: { latitude: location.latitude, longitude: location.longitude },
        isApproximate: false,
        source: DELIVERY_LOCATION_SOURCE.WHATSAPP_LOCATION,
      }
    }
    const resolved = await this.dependencies.resolveCepCoordinateUseCase.execute({ cep: location.cep })
    if (!resolved) return undefined
    return {
      coordinate: resolved,
      isApproximate: APPROXIMATE_PRECISIONS.has(String(resolved.precision)),
      source: DELIVERY_LOCATION_SOURCE.CEP,
    }
  }
}
