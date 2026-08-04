/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Previsão errada não quebra tela: faz a loja prometer horário que não cumpre, e isso aparece no
 * telefone de alguém reclamando. Por isso o cálculo é puro e está coberto aqui.
 */

import { describe, expect, it } from 'bun:test'
import { GEOCODE_PRECISION } from '@/modules/shared/address/Address.schema'
import { estimateDelivery } from '@/modules/shared/address/deliveryEstimate'
import { haversineDistanceKm } from '@/modules/shared/address/haversine'

const STORE = { latitude: -23.5614, longitude: -46.6559 }

const DEFAULTS = {
  detourFactor: 1.35,
  averageSpeedKmh: 25,
  preparationMinutes: 20,
}

describe('haversineDistanceKm', () => {
  it('mede um grau de latitude como ~111 km', () => {
    // Invariante geográfica, não número que eu inventei: com R=6371 km, 1° de latitude ≈ 111,19 km.
    // Se a fórmula for reescrita errada, é este teste que reprova.
    expect(haversineDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeCloseTo(111.19, 1)
  })

  it('mede um grau de longitude no equador como ~111 km, e quase nada perto do polo', () => {
    // A convergência dos meridianos é o que distingue haversine de subtração de coordenadas.
    const noEquador = haversineDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })
    const pertoDoPolo = haversineDistanceKm({ latitude: 89, longitude: 0 }, { latitude: 89, longitude: 1 })

    expect(noEquador).toBeCloseTo(111.19, 1)
    expect(pertoDoPolo).toBeLessThan(2)
  })

  it('é zero para o mesmo ponto e simétrica', () => {
    const a = { latitude: -23.5614, longitude: -46.6559 }
    const b = { latitude: -23.6266, longitude: -46.6556 }

    expect(haversineDistanceKm(a, a)).toBe(0)
    expect(haversineDistanceKm(a, b)).toBeCloseTo(haversineDistanceKm(b, a), 10)
  })
})

describe('estimateDelivery', () => {
  it('aplica o fator de desvio na distância', () => {
    const customerCoordinate = { latitude: -23.6266, longitude: -46.6556 }
    const straightLineKm = haversineDistanceKm(STORE, customerCoordinate)

    const semDesvio = estimateDelivery({
      ...DEFAULTS,
      detourFactor: 1,
      storeCoordinate: STORE,
      customerCoordinate,
      precision: GEOCODE_PRECISION.STREET,
    })
    const comDesvio = estimateDelivery({
      ...DEFAULTS,
      storeCoordinate: STORE,
      customerCoordinate,
      precision: GEOCODE_PRECISION.STREET,
    })

    expect(semDesvio.roadDistanceKm).toBeCloseTo(straightLineKm, 6)
    expect(comDesvio.roadDistanceKm).toBeCloseTo(straightLineKm * 1.35, 6)
  })

  it('na própria porta da loja, a previsão é só o preparo', () => {
    // 20 min de preparo, ±30% = 14 a 26, arredondado em passos de 5 = 15 a 25.
    const estimate = estimateDelivery({
      ...DEFAULTS,
      storeCoordinate: STORE,
      customerCoordinate: STORE,
      precision: GEOCODE_PRECISION.STREET,
    })

    expect(estimate.roadDistanceKm).toBe(0)
    expect(estimate.minMinutes).toBe(15)
    expect(estimate.maxMinutes).toBe(25)
    expect(estimate.isApproximate).toBe(false)
  })

  it('devolve faixa arredondada em passos de 5, nunca minuto cravado', () => {
    const estimate = estimateDelivery({
      ...DEFAULTS,
      storeCoordinate: STORE,
      customerCoordinate: { latitude: -23.6266, longitude: -46.6556 },
      precision: GEOCODE_PRECISION.STREET,
    })

    expect(estimate.minMinutes! % 5).toBe(0)
    expect(estimate.maxMinutes! % 5).toBe(0)
    expect(estimate.minMinutes!).toBeLessThan(estimate.maxMinutes!)
  })

  it('mais longe leva mais tempo', () => {
    const perto = estimateDelivery({
      ...DEFAULTS,
      storeCoordinate: STORE,
      customerCoordinate: { latitude: -23.57, longitude: -46.66 },
      precision: GEOCODE_PRECISION.STREET,
    })
    const longe = estimateDelivery({
      ...DEFAULTS,
      storeCoordinate: STORE,
      customerCoordinate: { latitude: -23.75, longitude: -46.7 },
      precision: GEOCODE_PRECISION.STREET,
    })

    expect(longe.roadDistanceKm).toBeGreaterThan(perto.roadDistanceKm)
    expect(longe.maxMinutes!).toBeGreaterThan(perto.maxMinutes!)
  })

  it('não promete horário quando a coordenada é o centroide da cidade', () => {
    // CEP genérico `-000` de cidade pequena cobre o município inteiro (spec §4.3, medido). A distância
    // sai como aproximada; horário não sai.
    const estimate = estimateDelivery({
      ...DEFAULTS,
      storeCoordinate: STORE,
      customerCoordinate: { latitude: -20.4739, longitude: -45.9575 },
      precision: GEOCODE_PRECISION.CITY,
    })

    expect(estimate.isApproximate).toBe(true)
    expect(estimate.minMinutes).toBeUndefined()
    expect(estimate.maxMinutes).toBeUndefined()
    expect(estimate.roadDistanceKm).toBeGreaterThan(0)
  })

  it('trata precisão desconhecida como aproximada, não como confiável', () => {
    // Precisão vinda de um provedor novo, ou de linha gravada por versão futura: o default seguro é
    // não prometer. O contrário — assumir precisão de rua — promete horário sobre dado desconhecido.
    const estimate = estimateDelivery({
      ...DEFAULTS,
      storeCoordinate: STORE,
      customerCoordinate: { latitude: -23.6266, longitude: -46.6556 },
      precision: GEOCODE_PRECISION.NONE,
    })

    expect(estimate.isApproximate).toBe(true)
    expect(estimate.minMinutes).toBeUndefined()
  })
})
