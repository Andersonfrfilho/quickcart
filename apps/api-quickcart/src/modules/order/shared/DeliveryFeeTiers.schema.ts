/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Validação da lista inteira de faixas (spec §3.1, D5): o painel faz PUT da lista, então o erro
 * precisa apontar TODAS as violações de uma vez — reportar uma por vez faria o operador salvar,
 * corrigir, salvar de novo, várias vezes, para uma tabela de no máximo 10 linhas.
 */

import { z } from 'zod'

export const DELIVERY_FEE_TIERS_MIN_COUNT = 1
export const DELIVERY_FEE_TIERS_MAX_COUNT = 10
export const DELIVERY_FEE_TIER_MIN_DISTANCE_KM = 0.1
export const DELIVERY_FEE_TIER_MAX_DISTANCE_KM = 50
export const DELIVERY_FEE_TIER_MIN_FEE_IN_CENTS = 0
export const DELIVERY_FEE_TIER_MAX_FEE_IN_CENTS = 100_000

/** Até 2 casas decimais: `12.345` tem 3, é rejeitado sem depender de erro de ponto flutuante. */
function hasAtMostTwoDecimalPlaces(value: number): boolean {
  return Math.round(value * 100) === value * 100
}

export const deliveryFeeTierInputSchema = z.object({
  maxDistanceKm: z
    .number()
    .min(DELIVERY_FEE_TIER_MIN_DISTANCE_KM, `maxDistanceKm deve ser >= ${DELIVERY_FEE_TIER_MIN_DISTANCE_KM}`)
    .max(DELIVERY_FEE_TIER_MAX_DISTANCE_KM, `maxDistanceKm deve ser <= ${DELIVERY_FEE_TIER_MAX_DISTANCE_KM}`)
    .refine(hasAtMostTwoDecimalPlaces, 'maxDistanceKm deve ter no máximo 2 casas decimais'),
  feeInCents: z
    .number()
    .int('feeInCents deve ser inteiro')
    .min(DELIVERY_FEE_TIER_MIN_FEE_IN_CENTS, `feeInCents deve ser >= ${DELIVERY_FEE_TIER_MIN_FEE_IN_CENTS}`)
    .max(DELIVERY_FEE_TIER_MAX_FEE_IN_CENTS, `feeInCents deve ser <= ${DELIVERY_FEE_TIER_MAX_FEE_IN_CENTS}`),
})

export type DeliveryFeeTierInput = z.infer<typeof deliveryFeeTierInputSchema>

export const deliveryFeeTiersInputSchema = z
  .array(deliveryFeeTierInputSchema)
  .min(DELIVERY_FEE_TIERS_MIN_COUNT, `A lista precisa ter ao menos ${DELIVERY_FEE_TIERS_MIN_COUNT} faixa`)
  .max(DELIVERY_FEE_TIERS_MAX_COUNT, `A lista pode ter no máximo ${DELIVERY_FEE_TIERS_MAX_COUNT} faixas`)
  /*
   * `superRefine` (não `refine`) para acumular a violação de crescimento estrito de CADA par, em vez
   * de parar na primeira — é o que garante "todos os erros de uma vez" numa lista de até 10 faixas.
   */
  .superRefine((tiers, ctx) => {
    for (let index = 1; index < tiers.length; index += 1) {
      const previous = tiers[index - 1]
      const current = tiers[index]
      if (previous && current && current.maxDistanceKm <= previous.maxDistanceKm) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'maxDistanceKm'],
          message: 'maxDistanceKm deve ser estritamente crescente entre as faixas',
        })
      }
    }
  })

export type DeliveryFeeTiersInput = z.infer<typeof deliveryFeeTiersInputSchema>
