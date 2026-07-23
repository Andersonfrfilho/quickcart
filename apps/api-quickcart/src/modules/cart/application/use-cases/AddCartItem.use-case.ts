/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { generateId } from '@/shared/id'
import { ProductNotFoundError } from '@/shared/errors/CatalogErrors'
import { CartItemInvalidQuantityError, CartProductUnavailableError } from '@/shared/errors/CartErrors'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { AddCartItemParams, AddCartItemResult } from '../types/AddCartItem.types'

type AddCartItemUseCaseDependencies = {
  readonly cartRepository: CartRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
}

export class AddCartItemUseCase {
  constructor(private readonly dependencies: AddCartItemUseCaseDependencies) {}

  async execute(params: AddCartItemParams): Promise<AddCartItemResult> {
    if (params.quantity <= 0) throw new CartItemInvalidQuantityError(params.quantity)

    const product = await this.dependencies.productRepository.findById(params.productId)
    if (!product) throw new ProductNotFoundError(params.productId)
    if (!product.isAvailable || product.stockQuantity <= 0) throw new CartProductUnavailableError(params.productId)

    const cart =
      (await this.dependencies.cartRepository.findOpenByCustomer(params.customerId, params.channel)) ??
      (await this.dependencies.cartRepository.create({
        id: generateId(),
        customerId: params.customerId,
        channel: params.channel,
      }))

    const existingItem = await this.dependencies.cartRepository.findItemByProduct(cart.id, params.productId)

    if (existingItem) {
      const item = await this.dependencies.cartRepository.updateItemQuantity(
        existingItem.id,
        existingItem.quantity + params.quantity,
      )
      return { cart, item: item ?? existingItem }
    }

    const item = await this.dependencies.cartRepository.addItem({
      id: generateId(),
      cartId: cart.id,
      productId: params.productId,
      quantity: params.quantity,
      matchType: params.matchType,
      originalTerm: params.originalTerm,
    })

    return { cart, item }
  }
}
