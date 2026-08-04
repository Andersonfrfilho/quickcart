/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Estado `resolving_items` (spec §3.3): resolve o item ambíguo no topo da fila
 * a cada resposta — seleção (`product:<uuid>`) vai pro draft do carrinho como
 * matchType 'selected', `skip_item` descarta o termo — e delega o avanço da
 * fila (próximo item ou fechamento em cart_review) a advanceResolutionQueue.
 */

import type { AddCartItemUseCase } from '@/modules/cart/application/use-cases/AddCartItem.use-case'
import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import type { ConversationHandlerContext, ConversationHandlerInterface } from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import type { CartDraftItem, ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { advanceResolutionQueue } from '@/modules/conversation/application/handlers/support/advanceResolutionQueue'
import { cheapestCandidate } from '@/modules/conversation/application/handlers/support/InteractiveListBuilders'
import {
  UNMATCHED_DEMAND_SOURCE,
  type UnmatchedDemandRepositoryInterface,
} from '@/modules/conversation/domain/UnmatchedDemandRepository.interface'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'
import { MESSAGES, RESOLVE_ROW_ID, RESOLVE_ROW_PREFIX } from '@/modules/conversation/shared/Messages.constant'
import { CHANNEL } from '@/modules/shared/shared.constant'

export type ResolveHandlerDependencies = {
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
  readonly cartRepository: CartRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
  readonly addCartItemUseCase: AddCartItemUseCase
  /** Registra "nenhum desses" como demanda do lojista. Ausente, o relatório só não recebe o dado. */
  readonly unmatchedDemandRepository?: UnmatchedDemandRepositoryInterface | undefined
}

/** Marca junto do nome: entre três "Leite Integral 1L", é ela que diz o que foi escolhido. */
function formatChosenName(candidate: { readonly name: string; readonly brand?: string | null }): string {
  return candidate.brand ? `${candidate.name} (${candidate.brand})` : candidate.name
}

const resolveLog = logger.child('ResolveHandler')

export class ResolveHandler implements ConversationHandlerInterface {
  constructor(private readonly dependencies: ResolveHandlerDependencies) {}

  async handle({ session, customer, message }: ConversationHandlerContext): Promise<void> {
    const context = (session.context ?? {}) as ConversationContext
    const pendingResolutions = context.pendingResolutions ?? []
    const current = pendingResolutions[0]

    if (!current) {
      await advanceResolutionQueue({
        session,
        customerId: customer.id,
        channel: CHANNEL.WHATSAPP,
        context: { ...context, pendingResolutions: [] },
        conversationSessionRepository: this.dependencies.conversationSessionRepository,
        whatsAppSender: this.dependencies.whatsAppSender,
        cartRepository: this.dependencies.cartRepository,
        productRepository: this.dependencies.productRepository,
        addCartItemUseCase: this.dependencies.addCartItemUseCase,
      ...(this.dependencies.unmatchedDemandRepository
        ? { unmatchedDemandRepository: this.dependencies.unmatchedDemandRepository }
        : {}),
      })
      return
    }

    if (message.kind !== 'list_reply') {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.RESOLVE_UNEXPECTED_INPUT)
      return
    }

    const cartDraft: CartDraftItem[] = [...(context.cartDraft ?? [])]
    const unmatchedTerms: string[] = [...(context.unmatchedTerms ?? [])]

    if (message.listId === RESOLVE_ROW_ID.SKIP_ITEM) {
      unmatchedTerms.push(current.originalTerm)

      /**
       * "Nenhum desses" é demanda com motivo próprio: a loja TEM algo parecido e não tem o certo.
       *
       * Misturar com "não achei nada" apagaria a diferença que muda a decisão do lojista — um caso
       * pede produto novo na prateleira, o outro pede a marca ou o tamanho que falta.
       */
      try {
        await this.dependencies.unmatchedDemandRepository?.record({
          terms: [current.originalTerm],
          customerId: customer.id,
          source: UNMATCHED_DEMAND_SOURCE.RESOLUTION_SKIPPED,
        })
      } catch (error: unknown) {
        resolveLog.warn('unmatched_demand_not_recorded', { error: serializeError(error) })
      }
    } else if (message.listId === RESOLVE_ROW_ID.CHEAPEST) {
      const cheapest = cheapestCandidate(current.candidates)
      if (!cheapest) {
        await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.RESOLVE_UNEXPECTED_INPUT)
        return
      }

      cartDraft.push({
        productId: cheapest.productId,
        name: cheapest.name,
        priceInCents: cheapest.priceInCents,
        quantity: current.quantity,
        matchType: 'selected',
        originalTerm: current.originalTerm,
      })

      // Diz QUAL foi: o cliente delegou o critério, não o direito de saber o que entrou no carrinho.
      await this.dependencies.whatsAppSender.sendText(
        session.customerPhone,
        MESSAGES.RESOLVE_CHEAPEST_CONFIRMATION.replace('{produto}', formatChosenName(cheapest)).replace(
          '{preco}',
          formatPriceInCents(cheapest.priceInCents),
        ),
      )
    } else if (message.listId.startsWith(RESOLVE_ROW_PREFIX.PRODUCT)) {
      const productId = message.listId.slice(RESOLVE_ROW_PREFIX.PRODUCT.length)
      const chosen = current.candidates.find((candidate) => candidate.productId === productId)
      if (!chosen) {
        await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.RESOLVE_UNEXPECTED_INPUT)
        return
      }

      cartDraft.push({
        productId: chosen.productId,
        name: chosen.name,
        priceInCents: chosen.priceInCents,
        quantity: current.quantity,
        matchType: 'selected',
        originalTerm: current.originalTerm,
      })
    } else {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.RESOLVE_UNEXPECTED_INPUT)
      return
    }

    await advanceResolutionQueue({
      session,
      customerId: customer.id,
      channel: CHANNEL.WHATSAPP,
      context: { cartDraft, unmatchedTerms, pendingResolutions: pendingResolutions.slice(1) },
      conversationSessionRepository: this.dependencies.conversationSessionRepository,
      whatsAppSender: this.dependencies.whatsAppSender,
      cartRepository: this.dependencies.cartRepository,
      productRepository: this.dependencies.productRepository,
      addCartItemUseCase: this.dependencies.addCartItemUseCase,
      ...(this.dependencies.unmatchedDemandRepository
        ? { unmatchedDemandRepository: this.dependencies.unmatchedDemandRepository }
        : {}),
    })
  }
}
