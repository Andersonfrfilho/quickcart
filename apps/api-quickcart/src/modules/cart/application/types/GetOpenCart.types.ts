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

export type GetOpenCartParams = {
  readonly customerId: string
  readonly channel: string
}

export type GetOpenCartResult = {
  readonly cart: CartRecord
  readonly items: CartItemRecord[]
} | undefined
