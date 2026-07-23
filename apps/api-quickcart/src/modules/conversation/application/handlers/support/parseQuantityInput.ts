/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Parser de quantidade em texto livre compartilhado entre BrowseHandler
 * (awaiting_quantity) e CartHandler (editing_cart) — mesma regra em ambos:
 * número opcional seguido de unidade (kg/g/l/ml/un), padrão 'un'.
 */

const QUANTITY_INPUT_PATTERN = /^(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|un|unidades?)?$/i

export type ParsedQuantityInput = {
  readonly quantity: number
  readonly unit: string
}

export function parseQuantityInput(rawText: string): ParsedQuantityInput | undefined {
  const match = rawText.trim().match(QUANTITY_INPUT_PATTERN)
  if (!match) return undefined

  const quantity = Number.parseFloat(match[1]!.replace(',', '.'))
  if (Number.isNaN(quantity) || quantity <= 0) return undefined

  return { quantity, unit: (match[2] ?? 'un').toLowerCase() }
}
