/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Distância corrigida e previsão de chegada — a parte do cálculo que decide o que a loja promete.
 *
 * Tudo aqui é função pura sobre números que o chamador já resolveu. O motivo é o custo do erro: uma
 * previsão errada não quebra tela nenhuma, ela faz a loja prometer horário que não cumpre, e isso só
 * aparece no telefone de alguém reclamando. Sem I/O, o comportamento inteiro cabe em teste.
 */

import { GEOCODE_PRECISION, type GeocodePrecision } from '@/modules/shared/address/Address.schema'
import { haversineDistanceKm, type Coordinate } from '@/modules/shared/address/haversine'

/**
 * Precisões em que a coordenada NÃO sustenta uma previsão.
 *
 * `city` é o centroide do município (medido na spec §4.3: CEP genérico `-000` de cidade pequena
 * cobre a cidade inteira e pode errar quilômetros). Prometer "chega 14h35" a partir disso é pior que
 * não prometer nada — e a distância também sai como aproximada, não como número cravado.
 */
const PRECISIONS_WITHOUT_ESTIMATE: ReadonlySet<string> = new Set([GEOCODE_PRECISION.CITY, GEOCODE_PRECISION.NONE])

/**
 * A faixa é ±30% e arredondada em passos de 5 minutos.
 *
 * "37–48 min" alegaria uma precisão que o modelo não tem — velocidade média e fator de desvio são
 * estimativas grosseiras. Passo de 5 comunica a ordem de grandeza, que é a informação real.
 */
const ESTIMATE_SPREAD = 0.3
const MINUTES_ROUNDING_STEP = 5

const MINUTES_PER_HOUR = 60

/**
 * Quanto MENOR o número, pior a precisão. Desconhecido cai em 0 junto com `none`.
 *
 * Existe para combinar duas coordenadas: uma distância entre dois pontos não é mais precisa que o
 * pior dos dois. Loja com CEP genérico de cidade pequena torna toda distância aproximada, mesmo com
 * cliente em CEP de bairro — o erro de um lado não é compensado pela exatidão do outro.
 */
const PRECISION_RANK: Readonly<Record<string, number>> = {
  [GEOCODE_PRECISION.NONE]: 0,
  [GEOCODE_PRECISION.CITY]: 1,
  [GEOCODE_PRECISION.POSTAL_CODE]: 2,
  [GEOCODE_PRECISION.STREET]: 3,
}

export function worstPrecision(left: string, right: string): string {
  return (PRECISION_RANK[left] ?? 0) <= (PRECISION_RANK[right] ?? 0) ? left : right
}

export type DeliveryEstimateParams = {
  readonly storeCoordinate: Coordinate
  readonly customerCoordinate: Coordinate
  readonly precision: GeocodePrecision | string
  /** Haversine é linha reta e subestima o percurso urbano. Ponto de partida 1.35, a CALIBRAR com entrega real. */
  readonly detourFactor: number
  readonly averageSpeedKmh: number
  readonly preparationMinutes: number
}

export type DeliveryEstimate = {
  /** Linha reta corrigida pelo fator de desvio — o que a tela mostra como distância. */
  readonly roadDistanceKm: number
  /** `undefined` quando a precisão não sustenta previsão; a distância continua útil como aproximada. */
  readonly minMinutes?: number
  readonly maxMinutes?: number
  readonly isApproximate: boolean
}

function roundToStep(minutes: number): number {
  return Math.max(MINUTES_ROUNDING_STEP, Math.round(minutes / MINUTES_ROUNDING_STEP) * MINUTES_ROUNDING_STEP)
}

export function estimateDelivery(params: DeliveryEstimateParams): DeliveryEstimate {
  const straightLineKm = haversineDistanceKm(params.storeCoordinate, params.customerCoordinate)
  const roadDistanceKm = straightLineKm * params.detourFactor
  const isApproximate = PRECISIONS_WITHOUT_ESTIMATE.has(params.precision)

  if (isApproximate) return { roadDistanceKm, isApproximate: true }

  const travelMinutes = (roadDistanceKm / params.averageSpeedKmh) * MINUTES_PER_HOUR
  const totalMinutes = params.preparationMinutes + travelMinutes

  return {
    roadDistanceKm,
    minMinutes: roundToStep(totalMinutes * (1 - ESTIMATE_SPREAD)),
    maxMinutes: roundToStep(totalMinutes * (1 + ESTIMATE_SPREAD)),
    isApproximate: false,
  }
}
