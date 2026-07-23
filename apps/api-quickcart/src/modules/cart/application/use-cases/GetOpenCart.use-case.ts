/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { GetOpenCartParams, GetOpenCartResult } from '../types/GetOpenCart.types'

type GetOpenCartUseCaseDependencies = {
  readonly cartRepository: CartRepositoryInterface
}

export class GetOpenCartUseCase {
  constructor(private readonly dependencies: GetOpenCartUseCaseDependencies) {}

  async execute(params: GetOpenCartParams): Promise<GetOpenCartResult> {
    const cart = await this.dependencies.cartRepository.findOpenByCustomer(params.customerId, params.channel)
    if (!cart) return undefined

    const items = await this.dependencies.cartRepository.listItems(cart.id)
    return { cart, items }
  }
}
