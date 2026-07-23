/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { CartItemNotFoundError } from '@/shared/errors/CartErrors'
import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { RemoveCartItemParams } from '../types/RemoveCartItem.types'

type RemoveCartItemUseCaseDependencies = {
  readonly cartRepository: CartRepositoryInterface
}

export class RemoveCartItemUseCase {
  constructor(private readonly dependencies: RemoveCartItemUseCaseDependencies) {}

  async execute(params: RemoveCartItemParams): Promise<void> {
    const item = await this.dependencies.cartRepository.findItemById(params.cartItemId)
    if (!item) throw new CartItemNotFoundError(params.cartItemId)

    await this.dependencies.cartRepository.removeItem(params.cartItemId)
  }
}
