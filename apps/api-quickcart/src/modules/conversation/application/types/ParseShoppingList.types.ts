/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

export type ParseShoppingListParams = {
  readonly rawText: string
}

export type ParsedListItem = {
  readonly term: string
  readonly quantity: number
  readonly unit: string
}

export type ParseShoppingListResult = {
  readonly items: readonly ParsedListItem[]
  readonly refinedByGroq: boolean
}
