/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Monta a pergunta "continuar ou começar do zero" — ou devolve `undefined` quando não há nada a
 * retomar. Vive fora dos handlers porque quem faz a pergunta (GreetingHandler, na volta) e quem a
 * repete (CartResumeHandler, quando o cliente responde outra coisa) precisam da MESMA frase: duas
 * versões da mesma pergunta, com contagens diferentes, é o tipo de divergência que só aparece em
 * produção.
 */

import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { CHANNEL } from '@/modules/shared/shared.constant'

export type CartResumeQuestion = {
  readonly bodyText: string
  readonly cartId: string
  readonly shortCode: string
  readonly itemCount: number
}

export type BuildCartResumeQuestionParams = {
  readonly customerId: string
  readonly cartRepository: Pick<CartRepositoryInterface, 'findOpenByCustomer' | 'listItems'>
}

export async function buildCartResumeQuestion(
  params: BuildCartResumeQuestionParams,
): Promise<CartResumeQuestion | undefined> {
  const cart = await params.cartRepository.findOpenByCustomer(params.customerId, CHANNEL.WHATSAPP)
  if (!cart) return undefined

  const items = await params.cartRepository.listItems(cart.id)
  // Carrinho aberto e vazio não é compra começada: perguntar sobre ele seria ruído.
  if (items.length === 0) return undefined

  const itemsLabel = items.length === 1 ? '1 item' : `${items.length} itens`

  return {
    bodyText: MESSAGES.CART_RESUME_ASK.replace('{codigo}', cart.shortCode).replace('{itens}', itemsLabel),
    cartId: cart.id,
    shortCode: cart.shortCode,
    itemCount: items.length,
  }
}
