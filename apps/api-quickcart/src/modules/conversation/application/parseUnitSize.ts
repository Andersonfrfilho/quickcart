/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Nenhum outro ponto do código já parseia `unitSize` para um valor numérico (os usos existentes só
 * exibem a string crua). A dimensão (massa vs volume) vai junto do valor, e não só o número em base
 * comum: sem ela "1000" de `1kg` e "1000" de `1L` ficariam indistinguíveis, e `resolvePackQuantity`
 * casaria quilo com litro por acidente.
 */

export const UNIT_DIMENSION = {
  MASS: 'mass',
  VOLUME: 'volume',
} as const

export type UnitDimension = (typeof UNIT_DIMENSION)[keyof typeof UNIT_DIMENSION]

export type ParsedUnitSize = {
  /** Sempre normalizado para a menor unidade da dimensão: gramas para massa, mililitros para volume. */
  readonly amount: number
  readonly dimension: UnitDimension
}

const UNIT_SIZE_PATTERN = /^(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml)$/i

const UNIT_MULTIPLIER: Record<string, { readonly dimension: UnitDimension; readonly toBaseUnit: number }> = {
  kg: { dimension: UNIT_DIMENSION.MASS, toBaseUnit: 1000 },
  g: { dimension: UNIT_DIMENSION.MASS, toBaseUnit: 1 },
  l: { dimension: UNIT_DIMENSION.VOLUME, toBaseUnit: 1000 },
  ml: { dimension: UNIT_DIMENSION.VOLUME, toBaseUnit: 1 },
}

/**
 * Converte um `unitSize` de catálogo ("5kg", "1,5kg", "500g", "1L", "900ml") em gramas ou mililitros.
 *
 * `undefined` para qualquer coisa fora desse formato — "5x200g" (kit) e "12 rolos" (unidade, não peso)
 * de propósito: o chamador cai no comportamento de hoje (regra 3) em vez de arriscar um parse errado.
 */
export function parseUnitSize(unitSize: string | null | undefined): ParsedUnitSize | undefined {
  if (!unitSize) return undefined

  const match = UNIT_SIZE_PATTERN.exec(unitSize.trim())
  if (!match) return undefined

  const [, rawAmount, rawUnit] = match
  const amount = Number.parseFloat(rawAmount!.replace(',', '.'))
  if (!Number.isFinite(amount) || amount <= 0) return undefined

  const unit = UNIT_MULTIPLIER[rawUnit!.toLowerCase()]
  if (!unit) return undefined

  return { amount: amount * unit.toBaseUnit, dimension: unit.dimension }
}
