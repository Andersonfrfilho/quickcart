/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cobre os estados `browsing_categories` e `awaiting_quantity` (spec §4):
 * navegação por categoria → produtos paginados → quantidade manual, virando
 * item 'manual' no draft do carrinho. Páginas são 1-indexed, espelhando
 * ProductRepositoryInterface.list (offset = (page - 1) * perPage). O gatilho
 * "ver carrinho" só existe em browsing_categories (spec: transição não é
 * global) e materializa o draft via enterCartReview, igual ao fechamento
 * natural da fila de resolução.
 */

import type { ConversationSession } from '@/infra/database/schema'
import type { AddCartItemUseCase } from '@/modules/cart/application/use-cases/AddCartItem.use-case'
import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import type { ConversationHandlerContext, ConversationHandlerInterface } from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import type { CartDraftItem, ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { buildProductSection } from '@/modules/conversation/application/handlers/support/InteractiveListBuilders'
import { enterCartReview } from '@/modules/conversation/application/handlers/support/enterCartReview'
import { parseQuantityInput } from '@/modules/conversation/application/handlers/support/parseQuantityInput'
import { BROWSE_PRODUCTS_PER_PAGE } from '@/modules/conversation/shared/Browse.constant'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { BROWSE_ROW_ID, BROWSE_ROW_PREFIX, BROWSE_TRIGGER, MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { CHANNEL } from '@/modules/shared/shared.constant'

const FIRST_PAGE = 1

export type BrowseHandlerDependencies = {
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
  readonly productRepository: ProductRepositoryInterface
  readonly cartRepository: CartRepositoryInterface
  readonly addCartItemUseCase: AddCartItemUseCase
}

function isViewCartTrigger(rawText: string): boolean {
  const normalized = rawText.trim().toLowerCase()
  return (BROWSE_TRIGGER.VIEW_CART_WORDS as readonly string[]).includes(normalized)
}

export class BrowseHandler implements ConversationHandlerInterface {
  constructor(private readonly dependencies: BrowseHandlerDependencies) {}

  async handle(context: ConversationHandlerContext): Promise<void> {
    if (context.session.currentState === CONVERSATION_STATE.AWAITING_QUANTITY) {
      await this.handleAwaitingQuantity(context)
      return
    }

    await this.handleBrowsingCategories(context)
  }

  private async handleBrowsingCategories({ session, customer, message }: ConversationHandlerContext): Promise<void> {
    if (message.kind === 'text' && isViewCartTrigger(message.body)) {
      const browseContext = (session.context ?? {}) as ConversationContext
      await enterCartReview({
        session,
        customerId: customer.id,
        channel: CHANNEL.WHATSAPP,
        cartDraft: browseContext.cartDraft ?? [],
        unmatchedTerms: browseContext.unmatchedTerms ?? [],
        conversationSessionRepository: this.dependencies.conversationSessionRepository,
        whatsAppSender: this.dependencies.whatsAppSender,
        cartRepository: this.dependencies.cartRepository,
        productRepository: this.dependencies.productRepository,
        addCartItemUseCase: this.dependencies.addCartItemUseCase,
      })
      return
    }

    if (message.kind !== 'list_reply') {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.BROWSE_UNEXPECTED_INPUT)
      return
    }

    const browseContext = (session.context ?? {}) as ConversationContext

    if (message.listId.startsWith(BROWSE_ROW_PREFIX.CATEGORY)) {
      const categoryId = message.listId.slice(BROWSE_ROW_PREFIX.CATEGORY.length)
      await this.sendProductPage({ session, categoryId, page: FIRST_PAGE })
      return
    }

    if (message.listId === BROWSE_ROW_ID.NEXT_PAGE && browseContext.browsingCategoryId) {
      await this.sendProductPage({
        session,
        categoryId: browseContext.browsingCategoryId,
        page: (browseContext.browsingPage ?? FIRST_PAGE) + 1,
      })
      return
    }

    if (message.listId.startsWith(BROWSE_ROW_PREFIX.PRODUCT)) {
      await this.handleProductSelected(session, browseContext, message.listId.slice(BROWSE_ROW_PREFIX.PRODUCT.length))
      return
    }

    await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.BROWSE_UNEXPECTED_INPUT)
  }

  private async handleProductSelected(
    session: ConversationSession,
    browseContext: ConversationContext,
    productId: string,
  ): Promise<void> {
    const product = await this.dependencies.productRepository.findById(productId)
    if (!product) {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.BROWSE_UNEXPECTED_INPUT)
      return
    }

    await this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone: session.customerPhone,
      currentState: CONVERSATION_STATE.AWAITING_QUANTITY,
      context: {
        ...browseContext,
        awaitingQuantityProduct: { productId: product.id, name: product.name, priceInCents: product.priceInCents },
      },
    })
    await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.BROWSE_ASK_QUANTITY)
  }

  private async sendProductPage(params: { session: ConversationSession; categoryId: string; page: number }): Promise<void> {
    const { session, categoryId, page } = params
    const { items, total } = await this.dependencies.productRepository.list({
      categoryId: [categoryId],
      onlyAvailable: true,
      page,
      perPage: BROWSE_PRODUCTS_PER_PAGE,
      sortBy: 'name',
      sortDirection: 'asc',
    })

    if (items.length === 0 && page === FIRST_PAGE) {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.BROWSE_EMPTY_CATEGORY)
      return
    }

    const hasNextPage = page * BROWSE_PRODUCTS_PER_PAGE < total
    const existingContext = (session.context ?? {}) as ConversationContext

    await this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone: session.customerPhone,
      currentState: CONVERSATION_STATE.BROWSING_CATEGORIES,
      context: { ...existingContext, browsingCategoryId: categoryId, browsingPage: page },
    })

    const section = buildProductSection(items, hasNextPage)
    await this.dependencies.whatsAppSender.sendInteractiveList(session.customerPhone, MESSAGES.BROWSE_PICK_PRODUCT, 'Ver produtos', [section])
  }

  private async handleAwaitingQuantity({ session, message }: ConversationHandlerContext): Promise<void> {
    const context = (session.context ?? {}) as ConversationContext
    const product = context.awaitingQuantityProduct

    if (!product) {
      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.MAIN_MENU,
        context: {},
      })
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.FALLBACK_STATE_NOT_READY)
      return
    }

    if (message.kind !== 'text') {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.BROWSE_QUANTITY_INVALID)
      return
    }

    const parsedQuantity = parseQuantityInput(message.body)
    if (!parsedQuantity) {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.BROWSE_QUANTITY_INVALID)
      return
    }

    const { awaitingQuantityProduct: _removed, ...restContext } = context
    const cartDraft: CartDraftItem[] = [
      ...(context.cartDraft ?? []),
      {
        productId: product.productId,
        name: product.name,
        priceInCents: product.priceInCents,
        quantity: parsedQuantity.quantity,
        matchType: 'manual',
        originalTerm: product.name,
      },
    ]

    await this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone: session.customerPhone,
      currentState: CONVERSATION_STATE.BROWSING_CATEGORIES,
      context: { ...restContext, cartDraft },
    })

    await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.BROWSE_PRODUCT_ADDED)

    if (context.browsingCategoryId) {
      await this.sendProductPage({ session, categoryId: context.browsingCategoryId, page: context.browsingPage ?? FIRST_PAGE })
    }
  }
}
