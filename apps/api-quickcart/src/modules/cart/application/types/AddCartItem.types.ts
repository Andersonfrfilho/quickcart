/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { CartItemRecord, CartRecord } from '@/modules/cart/domain/CartRepository.interface'

export type AddCartItemParams = {
  readonly customerId: string
  readonly channel: string
  readonly productId: string
  readonly quantity: number
  readonly matchType: string
  readonly originalTerm?: string | undefined
}

export type AddCartItemResult = {
  readonly cart: CartRecord
  readonly item: CartItemRecord
}
