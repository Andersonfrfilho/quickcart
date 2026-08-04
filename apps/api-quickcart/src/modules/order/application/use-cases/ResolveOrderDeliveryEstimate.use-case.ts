/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A que distância o cliente está e quando o pedido chega — para o operador, não para o cliente.
 *
 * Devolve `undefined` em vez de lançar em TODO caminho que não dá para responder: pedido de retirada,
 * loja sem `STORE_CEP` configurado, endereço legado sem CEP, CEP que não geocodifica, mapa fora do ar.
 * A tela então mostra o endereço e cala sobre distância — que é o comportamento certo, porque o número
 * errado aqui vira promessa errada no telefone de quem comprou.
 */

import { DELIVERY_TYPE } from '@/modules/order/shared/Order.constant'
import { estimateDelivery, worstPrecision } from '@/modules/shared/address/deliveryEstimate'
import type { ResolveCepCoordinateUseCase } from '@/modules/shared/address/ResolveCepCoordinate.use-case'
import type { OrderRecord } from '@/modules/order/domain/OrderRepository.interface'

export type OrderDeliveryEstimate = {
  /** Já corrigida pelo fator de desvio — é o número que a tela mostra. */
  readonly distanceKm: number
  /** Ausentes quando a precisão não sustenta previsão (centroide de município). */
  readonly minMinutes?: number
  readonly maxMinutes?: number
  /** `true` = distância é ordem de grandeza, não medida; a tela precisa dizer isso. */
  readonly isApproximate: boolean
  /** Aviso, não trava (spec §8 Q2): quem decide atender fora do raio é a pessoa. */
  readonly isOutsideRadius: boolean
}

type ResolveOrderDeliveryEstimateDependencies = {
  readonly resolveCepCoordinateUseCase: ResolveCepCoordinateUseCase
  readonly storeCep: string | undefined
  readonly detourFactor: number
  readonly averageSpeedKmh: number
  readonly preparationMinutes: number
  readonly deliveryRadiusKm: number
}

/** O CEP do endereço do pedido, se o endereço for estruturado. Texto legado não tem CEP confiável. */
function extractCep(address: unknown): string | undefined {
  if (!address || typeof address !== 'object') return undefined
  const candidate = (address as Record<string, unknown>).cep
  return typeof candidate === 'string' && candidate.replace(/\D/g, '').length === 8 ? candidate : undefined
}

export class ResolveOrderDeliveryEstimateUseCase {
  constructor(private readonly dependencies: ResolveOrderDeliveryEstimateDependencies) {}

  async execute(params: { readonly order: OrderRecord }): Promise<OrderDeliveryEstimate | undefined> {
    // Retirada não tem distância até o cliente: ele vem até a loja (critério de aceite da spec §9).
    if (params.order.deliveryType !== DELIVERY_TYPE.DELIVERY) return undefined

    const storeCep = this.dependencies.storeCep
    if (!storeCep) return undefined

    const customerCep = extractCep(params.order.address)
    if (!customerCep) return undefined

    const [storeCoordinate, customerCoordinate] = await Promise.all([
      this.dependencies.resolveCepCoordinateUseCase.execute({ cep: storeCep }),
      this.dependencies.resolveCepCoordinateUseCase.execute({ cep: customerCep }),
    ])

    if (!storeCoordinate || !customerCoordinate) return undefined

    const estimate = estimateDelivery({
      storeCoordinate,
      customerCoordinate,
      // A distância entre dois pontos não é mais precisa que o pior dos dois.
      precision: worstPrecision(String(storeCoordinate.precision), String(customerCoordinate.precision)),
      detourFactor: this.dependencies.detourFactor,
      averageSpeedKmh: this.dependencies.averageSpeedKmh,
      preparationMinutes: this.dependencies.preparationMinutes,
    })

    return {
      distanceKm: estimate.roadDistanceKm,
      ...(estimate.minMinutes !== undefined ? { minMinutes: estimate.minMinutes } : {}),
      ...(estimate.maxMinutes !== undefined ? { maxMinutes: estimate.maxMinutes } : {}),
      isApproximate: estimate.isApproximate,
      isOutsideRadius: estimate.roadDistanceKm > this.dependencies.deliveryRadiusKm,
    }
  }
}
