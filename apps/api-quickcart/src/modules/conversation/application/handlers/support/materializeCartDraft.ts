/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Converte o `cartDraft` em memória (context jsonb) no carrinho real persistido
 * (Fase 5), no momento em que a conversa entra em cart_review. As chamadas a
 * AddCartItemUseCase precisam ser sequenciais: a primeira materializa (cria) o
 * carrinho aberto do cliente e as seguintes reaproveitam esse mesmo carrinho —
 * rodar em paralelo arriscaria criar carrinhos abertos duplicados.
 */

import type { AddCartItemUseCase } from '@/modules/cart/application/use-cases/AddCartItem.use-case'
import type { CartDraftItem } from '@/modules/conversation/shared/ConversationContext.types'

export type MaterializeCartDraftParams = {
  readonly customerId: string
  readonly channel: string
  readonly cartDraft: readonly CartDraftItem[]
  readonly addCartItemUseCase: AddCartItemUseCase
}

export type MaterializeCartDraftResult = {
  readonly cartId: string | undefined
  readonly failedTerms: readonly string[]
}

export async function materializeCartDraft(params: MaterializeCartDraftParams): Promise<MaterializeCartDraftResult> {
  const { customerId, channel, cartDraft, addCartItemUseCase } = params
  const failedTerms: string[] = []
  let cartId: string | undefined

  for (const draftItem of cartDraft) {
    try {
      const { cart } = await addCartItemUseCase.execute({
        customerId,
        channel,
        productId: draftItem.productId,
        quantity: draftItem.quantity,
        matchType: draftItem.matchType,
        originalTerm: draftItem.originalTerm,
      })
      cartId = cart.id
    } catch {
      failedTerms.push(draftItem.originalTerm)
    }
  }

  return { cartId, failedTerms }
}
