/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { CartItemInvalidQuantityError, CartItemNotFoundError } from '@/shared/errors/CartErrors'
import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { UpdateCartItemQuantityParams, UpdateCartItemQuantityResult } from '../types/UpdateCartItemQuantity.types'

type UpdateCartItemQuantityUseCaseDependencies = {
  readonly cartRepository: CartRepositoryInterface
}

export class UpdateCartItemQuantityUseCase {
  constructor(private readonly dependencies: UpdateCartItemQuantityUseCaseDependencies) {}

  async execute(params: UpdateCartItemQuantityParams): Promise<UpdateCartItemQuantityResult> {
    if (params.quantity <= 0) throw new CartItemInvalidQuantityError(params.quantity)

    const item = await this.dependencies.cartRepository.findItemById(params.cartItemId)
    if (!item) throw new CartItemNotFoundError(params.cartItemId)

    const updated = await this.dependencies.cartRepository.updateItemQuantity(params.cartItemId, params.quantity)
    return updated ?? { ...item, quantity: params.quantity }
  }
}
