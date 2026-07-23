/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Renderiza o carrinho real (persistido, pós-materialização) como texto +
 * botões de cart_review. Preço/nome vêm do productRepository pois
 * CartItemRecord guarda só productId/quantity (spec §3.3).
 */

import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import { CART_REVIEW_BUTTONS, MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'

export type SendCartSummaryParams = {
  readonly customerPhone: string
  readonly cartId: string
  readonly cartRepository: CartRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
}

export async function sendCartSummary(params: SendCartSummaryParams): Promise<void> {
  const { customerPhone, cartId, cartRepository, productRepository, whatsAppSender } = params
  const cartItems = await cartRepository.listItems(cartId)

  if (cartItems.length === 0) {
    await whatsAppSender.sendText(customerPhone, MESSAGES.CART_EMPTY)
    return
  }

  const products = await Promise.all(cartItems.map((item) => productRepository.findById(item.productId)))

  let totalInCents = 0
  const lines = cartItems.map((item, index) => {
    const product = products[index]
    const productName = product?.name ?? item.productId
    const lineTotalInCents = Math.round((product?.priceInCents ?? 0) * item.quantity)
    totalInCents += lineTotalInCents
    return `• ${item.quantity}x ${productName} — ${formatPriceInCents(lineTotalInCents)}`
  })

  const bodyText = [
    MESSAGES.CART_SUMMARY_HEADER,
    ...lines,
    '',
    `${MESSAGES.CART_SUMMARY_TOTAL_PREFIX} ${formatPriceInCents(totalInCents)}`,
  ].join('\n')

  await whatsAppSender.sendInteractiveButtons(customerPhone, bodyText, CART_REVIEW_BUTTONS)
}
