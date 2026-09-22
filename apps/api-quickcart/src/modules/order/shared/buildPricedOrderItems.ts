/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Preço por linha SEMPRE lido do banco, nunca do que o cliente mandou: o carrinho web guarda o
 * preço no navegador, que pode estar velho. Extraído de `CreateWebOrder.use-case.ts` para a
 * cotação de checkout (T2.2) reaproveitar a mesma leitura e validação, em vez de duplicá-la.
 */

import { ProductNotFoundError } from '@/shared/errors/CatalogErrors'
import { CartProductUnavailableError } from '@/shared/errors/CartErrors'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { CreateOrderItemInput } from '@/modules/order/domain/OrderRepository.interface'

export type BuildPricedOrderItemsRequestedItem = {
  readonly productId: string
  readonly quantity: number
}

export async function buildPricedOrderItems(
  productRepository: ProductRepositoryInterface,
  requestedItems: ReadonlyArray<BuildPricedOrderItemsRequestedItem>,
): Promise<CreateOrderItemInput[]> {
  const items: CreateOrderItemInput[] = []

  for (const requestedItem of requestedItems) {
    const product = await productRepository.findById(requestedItem.productId)
    if (!product) throw new ProductNotFoundError(requestedItem.productId)
    if (!product.isAvailable) throw new CartProductUnavailableError(requestedItem.productId)

    items.push({
      productId: product.id,
      productName: product.name,
      unitPriceInCents: product.priceInCents,
      quantity: requestedItem.quantity,
      totalInCents: Math.round(product.priceInCents * requestedItem.quantity),
    })
  }

  return items
}
