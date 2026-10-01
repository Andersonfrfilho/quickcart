/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O carrinho ainda não conhece a taxa de entrega (T2.2): o rótulo do total passou a ser
 * "Subtotal:" para não ser confundido com o valor final que o resumo de confirmação cobra.
 */

import { describe, expect, it } from 'bun:test'
import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'
import { sendCartSummary } from './CartSummary'

describe('sendCartSummary', () => {
  it('mostra "Subtotal:" em vez de "Total:"', async () => {
    const buttonMessages: { body: string }[] = []

    const cartRepository = {
      async listItems() {
        return [{ productId: 'rice', quantity: 2 }]
      },
    } as unknown as CartRepositoryInterface

    const productRepository = {
      async findById() {
        return { name: 'Arroz 5kg', priceInCents: 2490 }
      },
    } as unknown as ProductRepositoryInterface

    const whatsAppSender = {
      async sendInteractiveButtons(_phone: string, body: string) {
        buttonMessages.push({ body })
      },
    } as unknown as WhatsAppSender

    await sendCartSummary({
      customerPhone: '5511988887777',
      cartId: 'cart-1',
      cartRepository,
      productRepository,
      whatsAppSender,
    })

    const body = buttonMessages[0]?.body ?? ''
    expect(body).toContain(`Subtotal: ${formatPriceInCents(4980)}`)
    expect(body).not.toContain('Total:')
  })
})
