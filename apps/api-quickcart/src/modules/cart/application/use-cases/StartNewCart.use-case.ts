/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Fecha o carrinho aberto como abandonado e abre outro, com código próprio.
 *
 * O status `abandoned` existia na constante e nunca era escrito: na prática, todo carrinho que não
 * virava pedido ficava `open` para sempre, e a conversa seguinte somava itens em cima dele. Era assim
 * que a lista de uma conversa de teste reaparecia no pedido de um cliente real.
 *
 * Abandonar em vez de apagar: o que o cliente chegou a montar é histórico da loja, e some do caminho
 * sem sumir do banco.
 */

import { generateId } from '@/shared/id'
import { CART_STATUS } from '@/modules/cart/shared/Cart.constant'
import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { StartNewCartParams, StartNewCartResult } from '../types/StartNewCart.types'

type StartNewCartUseCaseDependencies = {
  readonly cartRepository: CartRepositoryInterface
}

export class StartNewCartUseCase {
  constructor(private readonly dependencies: StartNewCartUseCaseDependencies) {}

  async execute(params: StartNewCartParams): Promise<StartNewCartResult> {
    const { cartRepository } = this.dependencies
    const previous = await cartRepository.findOpenByCustomer(params.customerId, params.channel)

    if (previous) {
      await cartRepository.updateStatus(previous.id, CART_STATUS.ABANDONED)
    }

    const cart = await cartRepository.create({
      id: generateId(),
      customerId: params.customerId,
      channel: params.channel,
    })

    return { cart, abandonedCart: previous }
  }
}
