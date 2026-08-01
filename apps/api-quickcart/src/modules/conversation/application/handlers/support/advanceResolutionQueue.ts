/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Ponto único que decide o próximo passo depois de mesclar itens no draft do
 * carrinho (spec §3.3): envia a lista interativa do próximo item ambíguo, ou
 * materializa o draft e fecha em `cart_review` (via enterCartReview) quando a
 * fila de pendências esvazia. Compartilhado por ListHandler (primeira leva) e
 * ResolveHandler (avança a fila).
 */

import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { AddCartItemUseCase } from '@/modules/cart/application/use-cases/AddCartItem.use-case'
import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { buildResolveSection } from '@/modules/conversation/application/handlers/support/InteractiveListBuilders'
import { enterCartReview } from '@/modules/conversation/application/handlers/support/enterCartReview'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'

export type AdvanceResolutionQueueParams = {
  readonly session: ConversationSession
  readonly customerId: string
  readonly channel: string
  readonly context: ConversationContext
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
  readonly cartRepository: CartRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
  readonly addCartItemUseCase: AddCartItemUseCase
}

export async function advanceResolutionQueue(params: AdvanceResolutionQueueParams): Promise<void> {
  const {
    session,
    customerId,
    channel,
    context,
    conversationSessionRepository,
    whatsAppSender,
    cartRepository,
    productRepository,
    addCartItemUseCase,
  } = params
  const cartDraft = context.cartDraft ?? []
  const unmatchedTerms = context.unmatchedTerms ?? []
  const pendingResolutions = context.pendingResolutions ?? []
  const nextPending = pendingResolutions[0]

  if (!nextPending) {
    await enterCartReview({
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
    })
    return
  }

  await conversationSessionRepository.updateStateByPhone({
    customerPhone: session.customerPhone,
    currentState: CONVERSATION_STATE.RESOLVING_ITEMS,
    context: { cartDraft, unmatchedTerms, pendingResolutions },
  })

  const section = buildResolveSection(nextPending)
  /**
   * Quantas escolhas ainda vêm depois desta.
   *
   * Lista de supermercado com vinte itens rende uma sequência de perguntas, e sem saber onde ela
   * termina o cliente desiste no meio — a sensação é de interrogatório sem fim. Sai do tamanho da
   * fila, sem contabilidade nova: é sempre verdade no momento em que a mensagem é montada.
   */
  const remainingAfterThis = pendingResolutions.length - 1
  const remainingSuffix =
    remainingAfterThis > 0 ? ` (falta${remainingAfterThis > 1 ? 'm' : ''} ${remainingAfterThis} depois)` : ''
  const bodyText = `${MESSAGES.RESOLVE_PROMPT_PREFIX} "${nextPending.originalTerm}"${remainingSuffix}`
  await whatsAppSender.sendInteractiveList(session.customerPhone, bodyText, 'Ver opções', [section])
}
