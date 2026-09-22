/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O carrinho em andamento mora na tabela `carts` (status aberto), e não no `cartDraft` do contexto:
 * o rascunho só existe até a revisão do carrinho, que o materializa. O checkout lê a tabela, e o card
 * tem de mostrar o mesmo carrinho que o checkout vai fechar.
 */

import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { CustomerRepositoryInterface } from '@/modules/webhook/domain/CustomerRepository.interface'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { CHECKOUT_CONTEXT_RESPONSE_SCHEMA } from '@/modules/conversation/shared/CheckoutContext.schema'
import { CHANNEL } from '@/modules/shared/shared.constant'
import { amountDueInCents } from '@/modules/order/shared/amountDue'
import { formatAddressLine } from '@/modules/shared/address/formatAddressLine'
import { resolveCheckoutDeliveryFeeInCents } from '@/modules/conversation/shared/resolveCheckoutDeliveryFeeInCents'
import type {
  ConversationCheckoutContext,
  GetConversationCheckoutContextParams,
  GetConversationCheckoutContextResult,
} from '../types/GetConversationCheckoutContext.types'

type GetConversationCheckoutContextUseCaseDependencies = {
  readonly conversationSessionRepository: Pick<ConversationSessionRepositoryInterface, 'findByPhone'>
  readonly customerRepository: Pick<CustomerRepositoryInterface, 'findByPhone'>
  readonly cartRepository: Pick<CartRepositoryInterface, 'findOpenByCustomer' | 'listItems'>
  readonly productRepository: Pick<ProductRepositoryInterface, 'findByIds'>
}

type CheckoutItem = ConversationCheckoutContext['items'][number]

export class GetConversationCheckoutContextUseCase {
  constructor(private readonly dependencies: GetConversationCheckoutContextUseCaseDependencies) {}

  async execute(params: GetConversationCheckoutContextParams): Promise<GetConversationCheckoutContextResult> {
    const session = await this.dependencies.conversationSessionRepository.findByPhone(params.whatsappNumber)
    const context = (session?.context ?? {}) as ConversationContext
    const items = await this.loadOpenCartItems(params.whatsappNumber)
    const hasCheckout = context.checkoutDeliveryType !== undefined || context.checkoutPaymentMethod !== undefined
    if (items.length === 0 && !hasCheckout) return undefined

    const subtotalInCents = items.reduce((sum, item) => sum + item.lineTotalInCents, 0)
    // Entrega ainda sem cotação (endereço não informado) aparece sem taxa no card; a T3.3 mostra a faixa.
    const deliveryFeeInCents = resolveCheckoutDeliveryFeeInCents(context) ?? 0

    return CHECKOUT_CONTEXT_RESPONSE_SCHEMA.parse({
      items,
      subtotalInCents,
      deliveryType: context.checkoutDeliveryType ?? null,
      deliveryFeeInCents,
      amountDueInCents: amountDueInCents({ totalInCents: subtotalInCents, deliveryFeeInCents }),
      address: formatAddressLine(context.checkoutAddress) ?? null,
      paymentMethod: context.checkoutPaymentMethod ?? null,
      cashChangeForInCents: context.checkoutCashChangeForInCents ?? null,
    })
  }

  private async loadOpenCartItems(whatsappNumber: string): Promise<CheckoutItem[]> {
    const { customerRepository, cartRepository, productRepository } = this.dependencies
    const customer = await customerRepository.findByPhone(whatsappNumber)
    if (!customer) return []

    const cart = await cartRepository.findOpenByCustomer(customer.id, CHANNEL.WHATSAPP)
    if (!cart) return []

    const cartItems = await cartRepository.listItems(cart.id)
    if (cartItems.length === 0) return []

    const products = await productRepository.findByIds(cartItems.map((item) => item.productId))
    const productById = new Map(products.map((product) => [product.id, product]))

    return cartItems.map((item) => {
      const product = productById.get(item.productId)
      return {
        name: product?.name ?? item.productId,
        quantity: item.quantity,
        // Mesmo arredondamento do resumo do carrinho no WhatsApp: o card não pode divergir do que o cliente leu.
        lineTotalInCents: Math.round((product?.priceInCents ?? 0) * item.quantity),
      }
    })
  }
}
