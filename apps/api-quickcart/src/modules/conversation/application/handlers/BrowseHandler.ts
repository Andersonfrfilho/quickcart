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
 * ProductRepositoryInterface.list (offset = (page - 1) * perPage). Frase de
 * encerramento (`isCartDoneRequest`) só existe em browsing_categories (spec:
 * transição não é global) e materializa o draft via enterCartReview, igual ao
 * fechamento natural da fila de resolução.
 *
 * Depois de adicionar um produto (`handleAwaitingQuantity`), a lista de produtos NÃO é reenviada
 * sozinha — vão 3 botões ("mais desta categoria" / "outra categoria" / "ver carrinho"). Reenviar a
 * lista escondia a saída: o relato real foi o cliente dizer "Não" a "quer mais algum produto?" e
 * cair em "Não encontrei 'Não' 🤔", sem nada que levasse ao carrinho.
 */

import type { Category } from '@/infra/database/schema'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { AddCartItemUseCase } from '@/modules/cart/application/use-cases/AddCartItem.use-case'
import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import type { ConversationHandlerContext, ConversationHandlerInterface } from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import type { CartDraftItem, ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { isCartDoneRequest } from '@/modules/conversation/application/isCartDoneRequest'
import { buildBrowsePostAddButtons } from '@/modules/conversation/application/handlers/support/buildBrowsePostAddButtons'
import { buildProductSection } from '@/modules/conversation/application/handlers/support/InteractiveListBuilders'
import { enterCartReview } from '@/modules/conversation/application/handlers/support/enterCartReview'
import { sendCategoryList } from '@/modules/conversation/application/handlers/support/sendCategoryList'
import type { UnmatchedDemandRepositoryInterface } from '@/modules/conversation/domain/UnmatchedDemandRepository.interface'
import { paginateRows } from '@/modules/conversation/application/handlers/support/paginateRows'
import { parseQuantityInput } from '@/modules/conversation/application/handlers/support/parseQuantityInput'
import { BROWSE_PRODUCTS_PER_PAGE } from '@/modules/conversation/shared/Browse.constant'
import { MATCH_MAX_AMBIGUOUS_CANDIDATES, MATCH_MIN_THRESHOLD } from '@/modules/conversation/shared/Matcher.constant'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { BROWSE_POST_ADD_BUTTON_ID, BROWSE_ROW_ID, BROWSE_ROW_PREFIX, MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { CHANNEL } from '@/modules/shared/shared.constant'

const FIRST_PAGE = 1

export type BrowseHandlerDependencies = {
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
  readonly productRepository: ProductRepositoryInterface
  readonly cartRepository: CartRepositoryInterface
  readonly addCartItemUseCase: AddCartItemUseCase
  /** Só usado pelo botão "outra categoria" — reaproveita a mesma lista do menu (`sendCategoryList`). */
  readonly categoryRepository: { list(): Promise<Category[]> }
  /** Repassado ao `enterCartReview`: quem chega ao carrinho por aqui também pode perder item. */
  readonly unmatchedDemandRepository?: UnmatchedDemandRepositoryInterface | undefined
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
    if (message.kind === 'text' && isCartDoneRequest(message.body)) {
      await this.goToCartReview(session, customer.id)
      return
    }

    if (message.kind === 'button_reply') {
      await this.handlePostAddButton(session, customer.id, message.buttonId)
      return
    }

    if (message.kind === 'text') {
      await this.sendSearchResults({ session, term: message.body.trim(), page: FIRST_PAGE })
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

    if (message.listId === BROWSE_ROW_ID.PREVIOUS_PAGE && browseContext.browsingCategoryId) {
      await this.sendProductPage({
        session,
        categoryId: browseContext.browsingCategoryId,
        page: Math.max(FIRST_PAGE, (browseContext.browsingPage ?? FIRST_PAGE) - 1),
      })
      return
    }

    if (message.listId === BROWSE_ROW_ID.NEXT_SEARCH_PAGE && browseContext.browsingSearchTerm) {
      await this.sendSearchResults({
        session,
        term: browseContext.browsingSearchTerm,
        page: (browseContext.browsingSearchPage ?? FIRST_PAGE) + 1,
      })
      return
    }

    if (message.listId === BROWSE_ROW_ID.PREVIOUS_SEARCH_PAGE && browseContext.browsingSearchTerm) {
      await this.sendSearchResults({
        session,
        term: browseContext.browsingSearchTerm,
        page: Math.max(FIRST_PAGE, (browseContext.browsingSearchPage ?? FIRST_PAGE) - 1),
      })
      return
    }

    if (message.listId.startsWith(BROWSE_ROW_PREFIX.PRODUCT)) {
      await this.handleProductSelected(session, browseContext, message.listId.slice(BROWSE_ROW_PREFIX.PRODUCT.length))
      return
    }

    await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.BROWSE_UNEXPECTED_INPUT)
  }

  /** Único caminho para o carrinho a partir da navegação — frase de encerramento e botão "ver carrinho" caem aqui. */
  private async goToCartReview(session: ConversationSession, customerId: string): Promise<void> {
    const browseContext = (session.context ?? {}) as ConversationContext
    await enterCartReview({
      session,
      customerId,
      channel: CHANNEL.WHATSAPP,
      cartDraft: browseContext.cartDraft ?? [],
      unmatchedTerms: browseContext.unmatchedTerms ?? [],
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

  /**
   * Toque num dos 3 botões enviados depois de um produto adicionado (`handleAwaitingQuantity`).
   *
   * "Mais desta categoria" volta para a MESMA página em que o cliente estava — o contexto de
   * navegação (`browsingCategoryId`/`browsingPage`) sobrevive à transição, igual antes.
   */
  private async handlePostAddButton(session: ConversationSession, customerId: string, buttonId: string): Promise<void> {
    if (buttonId === BROWSE_POST_ADD_BUTTON_ID.VIEW_CART) {
      await this.goToCartReview(session, customerId)
      return
    }

    if (buttonId === BROWSE_POST_ADD_BUTTON_ID.OTHER_CATEGORY) {
      await sendCategoryList({
        categoryRepository: this.dependencies.categoryRepository,
        whatsAppSender: this.dependencies.whatsAppSender,
        customerPhone: session.customerPhone,
      })
      return
    }

    if (buttonId === BROWSE_POST_ADD_BUTTON_ID.MORE_CATEGORY) {
      const browseContext = (session.context ?? {}) as ConversationContext
      if (browseContext.browsingCategoryId) {
        await this.sendProductPage({
          session,
          categoryId: browseContext.browsingCategoryId,
          page: browseContext.browsingPage ?? FIRST_PAGE,
        })
        return
      }

      await sendCategoryList({
        categoryRepository: this.dependencies.categoryRepository,
        whatsAppSender: this.dependencies.whatsAppSender,
        customerPhone: session.customerPhone,
      })
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

  /**
   * Texto livre enquanto navega é o nome do produto que o cliente procura, não um erro.
   *
   * As linhas usam o mesmo prefixo da página da categoria, então o toque cai no fluxo de quantidade
   * de sempre. A página da categoria continua no contexto: "próxima página" segue funcionando.
   */
  private async sendSearchResults(params: { session: ConversationSession; term: string; page: number }): Promise<void> {
    const { session, term, page } = params
    const results = await this.dependencies.productRepository.searchByTerm(term, MATCH_MAX_AMBIGUOUS_CANDIDATES)
    const matches = results.filter((result) => result.score >= MATCH_MIN_THRESHOLD)

    if (matches.length === 0) {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.BROWSE_SEARCH_NOT_FOUND.replace('{termo}', term))
      return
    }

    const { pageItems, hasNextPage, hasPreviousPage } = paginateRows({
      items: matches,
      page,
      itemsPerPage: BROWSE_PRODUCTS_PER_PAGE,
    })
    const existingContext = (session.context ?? {}) as ConversationContext

    await this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone: session.customerPhone,
      currentState: CONVERSATION_STATE.BROWSING_CATEGORIES,
      context: { ...existingContext, browsingSearchTerm: term, browsingSearchPage: page },
    })

    const section = buildProductSection({
      products: pageItems,
      hasNextPage,
      hasPreviousPage,
      nextPageRowId: BROWSE_ROW_ID.NEXT_SEARCH_PAGE,
      previousPageRowId: BROWSE_ROW_ID.PREVIOUS_SEARCH_PAGE,
    })
    await this.dependencies.whatsAppSender.sendInteractiveList(
      session.customerPhone,
      MESSAGES.BROWSE_SEARCH_RESULTS.replace('{termo}', term),
      'Ver produtos',
      [section],
    )
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
    const hasPreviousPage = page > FIRST_PAGE
    const existingContext = (session.context ?? {}) as ConversationContext

    await this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone: session.customerPhone,
      currentState: CONVERSATION_STATE.BROWSING_CATEGORIES,
      context: { ...existingContext, browsingCategoryId: categoryId, browsingPage: page },
    })

    const section = buildProductSection({ products: items, hasNextPage, hasPreviousPage })
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

    const bodyText = MESSAGES.BROWSE_PRODUCT_ADDED.replace('{quantidade}', String(parsedQuantity.quantity)).replace(
      '{produto}',
      product.name,
    )
    await this.dependencies.whatsAppSender.sendInteractiveButtons(session.customerPhone, bodyText, buildBrowsePostAddButtons())
  }
}
