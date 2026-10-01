/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * "5 kg de arroz" não é "5 unidades do produto arroz" — é um PESO TOTAL, e o produto que casa pode
 * vir em qualquer tamanho de pacote. Ponto único de decisão (chamado tanto no match automático quanto
 * na escolha da lista de desambiguação) para nunca divergir: escolher "Arroz 5kg" na lista tem que
 * significar a mesma quantidade 1 que o match automático teria calculado para o mesmo produto.
 */

import { parseUnitSize, UNIT_DIMENSION, type UnitDimension } from '@/modules/conversation/application/parseUnitSize'

/**
 * Variantes faladas do item já parseado ("quilos", "litros") ao lado das siglas de catálogo — o
 * parser da lista de compras (`ParseShoppingList.use-case.ts`) não normaliza a unidade, só a
 * minúscula (`unit: unit.toLowerCase()`).
 */
const REQUESTED_UNIT_TO_BASE: Record<string, { readonly dimension: UnitDimension; readonly toBaseUnit: number }> = {
  kg: { dimension: UNIT_DIMENSION.MASS, toBaseUnit: 1000 },
  quilo: { dimension: UNIT_DIMENSION.MASS, toBaseUnit: 1000 },
  quilos: { dimension: UNIT_DIMENSION.MASS, toBaseUnit: 1000 },
  g: { dimension: UNIT_DIMENSION.MASS, toBaseUnit: 1 },
  grama: { dimension: UNIT_DIMENSION.MASS, toBaseUnit: 1 },
  gramas: { dimension: UNIT_DIMENSION.MASS, toBaseUnit: 1 },
  l: { dimension: UNIT_DIMENSION.VOLUME, toBaseUnit: 1000 },
  litro: { dimension: UNIT_DIMENSION.VOLUME, toBaseUnit: 1000 },
  litros: { dimension: UNIT_DIMENSION.VOLUME, toBaseUnit: 1000 },
  ml: { dimension: UNIT_DIMENSION.VOLUME, toBaseUnit: 1 },
}

export type ResolvePackQuantityParams = {
  readonly requestedQuantity: number
  readonly requestedUnit: string
  readonly unitSize: string | null | undefined
}

export type ResolvePackQuantityResult = {
  readonly quantity: number
}

/**
 * `undefined` quando a regra não se aplica: unidade pedida não é peso/volume, `unitSize` do produto
 * não é parseável, dimensões não batem (kg pedido contra pacote em ml), ou o total pedido não é
 * múltiplo exato do pacote. O chamador mantém o comportamento de hoje nesses casos (regra 3).
 */
export function resolvePackQuantity(params: ResolvePackQuantityParams): ResolvePackQuantityResult | undefined {
  const requestedUnit = REQUESTED_UNIT_TO_BASE[params.requestedUnit.trim().toLowerCase()]
  if (!requestedUnit) return undefined

  const parsedUnitSize = parseUnitSize(params.unitSize)
  if (!parsedUnitSize) return undefined

  if (requestedUnit.dimension !== parsedUnitSize.dimension) return undefined

  const requestedTotal = params.requestedQuantity * requestedUnit.toBaseUnit

  if (requestedTotal === parsedUnitSize.amount) return { quantity: 1 }

  if (requestedTotal % parsedUnitSize.amount === 0) {
    return { quantity: requestedTotal / parsedUnitSize.amount }
  }

  return undefined
}
