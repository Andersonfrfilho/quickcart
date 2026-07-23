/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { CartItemRecord } from '@/modules/cart/domain/CartRepository.interface'

export type UpdateCartItemQuantityParams = {
  readonly cartItemId: string
  readonly quantity: number
}

export type UpdateCartItemQuantityResult = CartItemRecord
