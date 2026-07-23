/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Repetir pedido não cria uma order diretamente — copia os itens do último pedido para um
 * cart aberto (criando um se necessário), deixando o cliente revisar/ajustar no cart_review
 * antes do checkout normal. Itens sem produto disponível são reportados em `skippedItems`
 * em vez de interromper o fluxo.
 */

import { generateId } from '@/shared/id'
import { OrderNoPreviousOrderError } from '@/shared/errors/OrderErrors'
import { CART_ITEM_MATCH_TYPE } from '@/modules/cart/shared/Cart.constant'
import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import type { RepeatLastOrderParams, RepeatLastOrderResult, SkippedRepeatOrderItem } from '../types/RepeatLastOrder.types'

type RepeatLastOrderUseCaseDependencies = {
  readonly orderRepository: OrderRepositoryInterface
  readonly cartRepository: CartRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
}

export class RepeatLastOrderUseCase {
  constructor(private readonly dependencies: RepeatLastOrderUseCaseDependencies) {}

  async execute(params: RepeatLastOrderParams): Promise<RepeatLastOrderResult> {
    const lastOrder = await this.dependencies.orderRepository.findLastByCustomer(params.customerId)
    if (!lastOrder) throw new OrderNoPreviousOrderError(params.customerId)

    const lastOrderItems = await this.dependencies.orderRepository.listItems(lastOrder.id)

    const cart =
      (await this.dependencies.cartRepository.findOpenByCustomer(params.customerId, params.channel)) ??
      (await this.dependencies.cartRepository.create({
        id: generateId(),
        customerId: params.customerId,
        channel: params.channel,
      }))

    const skippedItems: SkippedRepeatOrderItem[] = []

    for (const lastOrderItem of lastOrderItems) {
      const product = await this.dependencies.productRepository.findById(lastOrderItem.productId)
      if (!product || !product.isAvailable) {
        skippedItems.push({ productId: lastOrderItem.productId, productName: lastOrderItem.productName })
        continue
      }

      const existingItem = await this.dependencies.cartRepository.findItemByProduct(cart.id, product.id)
      if (existingItem) continue

      await this.dependencies.cartRepository.addItem({
        id: generateId(),
        cartId: cart.id,
        productId: product.id,
        quantity: lastOrderItem.quantity,
        matchType: CART_ITEM_MATCH_TYPE.MANUAL,
      })
    }

    const items = await this.dependencies.cartRepository.listItems(cart.id)
    return { cart, items, skippedItems }
  }
}
