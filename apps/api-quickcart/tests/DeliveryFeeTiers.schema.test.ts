/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O painel faz PUT da lista inteira (spec §3.1, D5): cada regra abaixo precisa reportar TODOS os
 * erros de uma vez, não só o primeiro que a validação encontra.
 */

import { describe, expect, it } from 'bun:test'
import { deliveryFeeTiersInputSchema } from '@/modules/order/shared/DeliveryFeeTiers.schema'

const VALID_TIERS = [
  { maxDistanceKm: 3, feeInCents: 500 },
  { maxDistanceKm: 8, feeInCents: 1000 },
]

describe('deliveryFeeTiersInputSchema', () => {
  it('aceita a lista válida de D4', () => {
    expect(deliveryFeeTiersInputSchema.safeParse(VALID_TIERS).success).toBe(true)
  })

  it('aceita taxa zero (D5 permite)', () => {
    expect(deliveryFeeTiersInputSchema.safeParse([{ maxDistanceKm: 5, feeInCents: 0 }]).success).toBe(true)
  })

  it('rejeita lista vazia', () => {
    expect(deliveryFeeTiersInputSchema.safeParse([]).success).toBe(false)
  })

  it('rejeita mais de 10 faixas', () => {
    const tiers = Array.from({ length: 11 }, (_, index) => ({ maxDistanceKm: index + 1, feeInCents: 100 }))
    expect(deliveryFeeTiersInputSchema.safeParse(tiers).success).toBe(false)
  })

  it('rejeita maxDistanceKm fora de 0,1–50', () => {
    expect(deliveryFeeTiersInputSchema.safeParse([{ maxDistanceKm: 0, feeInCents: 100 }]).success).toBe(false)
    expect(deliveryFeeTiersInputSchema.safeParse([{ maxDistanceKm: 50.01, feeInCents: 100 }]).success).toBe(false)
  })

  it('rejeita maxDistanceKm com mais de 2 casas decimais', () => {
    expect(deliveryFeeTiersInputSchema.safeParse([{ maxDistanceKm: 3.456, feeInCents: 100 }]).success).toBe(false)
  })

  it('rejeita feeInCents não inteiro, negativo ou acima de 100000', () => {
    expect(deliveryFeeTiersInputSchema.safeParse([{ maxDistanceKm: 3, feeInCents: 1.5 }]).success).toBe(false)
    expect(deliveryFeeTiersInputSchema.safeParse([{ maxDistanceKm: 3, feeInCents: -1 }]).success).toBe(false)
    expect(deliveryFeeTiersInputSchema.safeParse([{ maxDistanceKm: 3, feeInCents: 100_001 }]).success).toBe(false)
  })

  it('rejeita lista não estritamente crescente (igual ou decrescente)', () => {
    expect(
      deliveryFeeTiersInputSchema.safeParse([
        { maxDistanceKm: 5, feeInCents: 500 },
        { maxDistanceKm: 5, feeInCents: 1000 },
      ]).success,
    ).toBe(false)
    expect(
      deliveryFeeTiersInputSchema.safeParse([
        { maxDistanceKm: 8, feeInCents: 500 },
        { maxDistanceKm: 3, feeInCents: 1000 },
      ]).success,
    ).toBe(false)
  })

  it('taxa não precisa crescer com a distância', () => {
    expect(
      deliveryFeeTiersInputSchema.safeParse([
        { maxDistanceKm: 3, feeInCents: 1000 },
        { maxDistanceKm: 8, feeInCents: 500 },
      ]).success,
    ).toBe(true)
  })

  it('reporta todos os erros de uma vez, não só o primeiro', () => {
    const result = deliveryFeeTiersInputSchema.safeParse([
      { maxDistanceKm: 0, feeInCents: -1 },
      { maxDistanceKm: 60, feeInCents: 1.5 },
    ])
    expect(result.success).toBe(false)
    if (result.success) return
    // 2 faixas x 2 campos inválidos cada = ao menos 4 issues.
    expect(result.error.issues.length).toBeGreaterThanOrEqual(4)
  })
})
