/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { ParsedListItem } from '@/modules/conversation/application/types/ParseShoppingList.types'
import type { MatchType } from '@/modules/conversation/shared/Matcher.constant'

export type MatchCandidate = {
  readonly productId: string
  readonly name: string
  readonly brand: string | null
  readonly unitSize: string | null
  readonly priceInCents: number
  readonly score: number
}

export type MatchProductsParams = {
  readonly item: ParsedListItem
}

export type MatchProductsResult = {
  readonly item: ParsedListItem
  readonly matchType: MatchType
  readonly candidates: readonly MatchCandidate[]
}
