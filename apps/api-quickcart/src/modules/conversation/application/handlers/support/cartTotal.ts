/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O mesmo cálculo de `buildConfirmingSummary` (CheckoutHandler) e `sendCartSummary`,
 * isolado para o `CashChangeHandler` validar o troco sem duplicar a soma das linhas.
 */

/** Portas estreitas: só o que esta função usa, para o teste não precisar de repositório inteiro. */
export type CartTotalParams = {
  readonly cartId: string
  readonly cartRepository: { listItems(cartId: string): Promise<ReadonlyArray<{ readonly productId: string; readonly quantity: number }>> }
  readonly productRepository: { findById(id: string): Promise<{ readonly priceInCents: number } | undefined> }
}

export async function calculateCartTotalInCents(params: CartTotalParams): Promise<number> {
  const { cartId, cartRepository, productRepository } = params
  const cartItems = await cartRepository.listItems(cartId)
  const products = await Promise.all(cartItems.map((item) => productRepository.findById(item.productId)))

  return cartItems.reduce((total, item, index) => {
    const product = products[index]
    return total + Math.round((product?.priceInCents ?? 0) * item.quantity)
  }, 0)
}
