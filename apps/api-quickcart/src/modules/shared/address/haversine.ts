/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Distância em linha reta entre dois pontos — grátis, instantânea, zero chamada externa.
 *
 * É a escolha que torna o requisito "eficiente e grátis" possível: rota real exige API de
 * roteirização, e o ganho não justifica antes de haver histórico para calibrar. A correção do
 * percurso (o carro não atravessa quarteirão) é aplicada em `deliveryEstimate.ts`, não aqui —
 * esta função devolve o que promete, linha reta.
 */

const EARTH_RADIUS_KM = 6371

export type Coordinate = {
  readonly latitude: number
  readonly longitude: number
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

export function haversineDistanceKm(from: Coordinate, to: Coordinate): number {
  const deltaLatitude = toRadians(to.latitude - from.latitude)
  const deltaLongitude = toRadians(to.longitude - from.longitude)
  const fromLatitude = toRadians(from.latitude)
  const toLatitude = toRadians(to.latitude)

  const chordLength =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(deltaLongitude / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(chordLength))
}
