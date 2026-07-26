/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Ponto único de entrada em cart_review (spec §3.3): materializa o cartDraft em
 * memória no carrinho real, transiciona o estado da sessão e renderiza o resumo.
 * Usado por advanceResolutionQueue (fila de desambiguação esvaziada) e por
 * BrowseHandler (trigger "ver carrinho"). Se o draft materializado não gerar
 * carrinho (draft vazio), cai para um carrinho aberto pré-existente do cliente
 * antes de considerar o carrinho realmente vazio — cobre reentradas em
 * cart_review depois que os itens já foram materializados numa passada anterior.
 */

import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { AddCartItemUseCase } from '@/modules/cart/application/use-cases/AddCartItem.use-case'
import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import type { CartDraftItem } from '@/modules/conversation/shared/ConversationContext.types'
import { sendCartSummary } from '@/modules/conversation/application/handlers/support/CartSummary'
import { materializeCartDraft } from '@/modules/conversation/application/handlers/support/materializeCartDraft'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'

export type EnterCartReviewParams = {
  readonly session: ConversationSession
  readonly customerId: string
  readonly channel: string
  readonly cartDraft: readonly CartDraftItem[]
  readonly unmatchedTerms: readonly string[]
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
  readonly cartRepository: CartRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
  readonly addCartItemUseCase: AddCartItemUseCase
}

export async function enterCartReview(params: EnterCartReviewParams): Promise<void> {
  const {
    session,
    customerId,
    channel,
    cartDraft,
    unmatchedTerms,
    conversationSessionRepository,
    whatsAppSender,
    cartRepository,
    productRepository,
    addCartItemUseCase,
  } = params

  const materializeResult = await materializeCartDraft({ customerId, channel, cartDraft, addCartItemUseCase })
  const allUnmatchedTerms = [...unmatchedTerms, ...materializeResult.failedTerms]

  await conversationSessionRepository.updateStateByPhone({
    customerPhone: session.customerPhone,
    currentState: CONVERSATION_STATE.CART_REVIEW,
    context: { unmatchedTerms: allUnmatchedTerms },
  })

  if (allUnmatchedTerms.length > 0) {
    const bodyText = `${MESSAGES.CART_REVIEW_UNMATCHED_PREFIX}\n${allUnmatchedTerms.map((term) => `• ${term}`).join('\n')}`
    await whatsAppSender.sendText(session.customerPhone, bodyText)
  }

  const openCart = materializeResult.cartId
    ? undefined
    : await cartRepository.findOpenByCustomer(customerId, channel)
  const cartId = materializeResult.cartId ?? openCart?.id

  if (!cartId) {
    await whatsAppSender.sendText(session.customerPhone, MESSAGES.CART_EMPTY)
    return
  }

  await sendCartSummary({ customerPhone: session.customerPhone, cartId, cartRepository, productRepository, whatsAppSender })
}
