/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { ProductNotFoundError } from '@/shared/errors/CatalogErrors'
import { CartProductUnavailableError } from '@/shared/errors/CartErrors'
import { OrderEmptyCartError, OrderInsufficientStockError } from '@/shared/errors/OrderErrors'
import { CART_STATUS } from '@/modules/cart/shared/Cart.constant'
import { generateId } from '@/shared/id'
import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { OrderRepositoryInterface, CreateOrderItemInput } from '@/modules/order/domain/OrderRepository.interface'
import type { JobQueue } from '@/modules/order/domain/JobQueue.interface'
import type { CreateOrderFromCartParams, CreateOrderFromCartResult } from '../types/CreateOrderFromCart.types'

type CreateOrderFromCartUseCaseDependencies = {
  readonly orderRepository: OrderRepositoryInterface
  readonly cartRepository: CartRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
  readonly receiptQueue: JobQueue
}

export class CreateOrderFromCartUseCase {
  constructor(private readonly dependencies: CreateOrderFromCartUseCaseDependencies) {}

  async execute(params: CreateOrderFromCartParams): Promise<CreateOrderFromCartResult> {
    const cartItems = await this.dependencies.cartRepository.listItems(params.cartId)
    if (cartItems.length === 0) throw new OrderEmptyCartError(params.cartId)

    const items: CreateOrderItemInput[] = []
    for (const cartItem of cartItems) {
      const product = await this.dependencies.productRepository.findById(cartItem.productId)
      if (!product) throw new ProductNotFoundError(cartItem.productId)
      if (!product.isAvailable) throw new CartProductUnavailableError(cartItem.productId)

      items.push({
        productId: product.id,
        productName: product.name,
        unitPriceInCents: product.priceInCents,
        quantity: cartItem.quantity,
        totalInCents: Math.round(product.priceInCents * cartItem.quantity),
      })
    }

    const result = await this.dependencies.orderRepository.createWithStockDecrement({
      id: generateId(),
      customerId: params.customerId,
      cartId: params.cartId,
      channel: params.channel,
      deliveryType: params.deliveryType,
      address: params.address,
      paymentMethod: params.paymentMethod,
      receiptPreference: params.receiptPreference,
      notes: params.notes,
      items,
    })

    if (!result.ok) throw new OrderInsufficientStockError(result.insufficientItems)

    await this.dependencies.cartRepository.updateStatus(params.cartId, CART_STATUS.ORDERED)
    await this.dependencies.receiptQueue.add('issue-receipt', { orderId: result.order.id })

    return { order: result.order, items: result.items }
  }
}
