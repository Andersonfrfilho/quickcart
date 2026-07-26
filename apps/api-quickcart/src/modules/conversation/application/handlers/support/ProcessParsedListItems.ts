/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Casa cada item já parseado contra o catálogo (spec §3.2), mescla o resultado
 * no draft do carrinho existente na sessão e grava o list_import (spec: cada
 * parse gera uma linha de auditoria com as contagens desta chamada, não do
 * acumulado da sessão), delegando o próximo passo (avançar desambiguação ou
 * materializar e fechar em cart_review) para advanceResolutionQueue.
 */

import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { AddCartItemUseCase } from '@/modules/cart/application/use-cases/AddCartItem.use-case'
import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { ParsedListItem } from '@/modules/conversation/application/types/ParseShoppingList.types'
import type { MatchProductsUseCase } from '@/modules/conversation/application/use-cases/MatchProducts.use-case'
import type { ListImportRepositoryInterface } from '@/modules/conversation/domain/ListImportRepository.interface'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import type { CartDraftItem, ConversationContext, PendingResolution } from '@/modules/conversation/shared/ConversationContext.types'
import { advanceResolutionQueue } from '@/modules/conversation/application/handlers/support/advanceResolutionQueue'
import type { ListImportSource } from '@/modules/conversation/shared/ListImport.constant'
import { MATCH_TYPE } from '@/modules/conversation/shared/Matcher.constant'
import { generateId } from '@/shared/id'

export type ProcessParsedListItemsDependencies = {
  readonly matchProductsUseCase: MatchProductsUseCase
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
  readonly listImportRepository: ListImportRepositoryInterface
  readonly cartRepository: CartRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
  readonly addCartItemUseCase: AddCartItemUseCase
}

export type ProcessParsedListItemsParams = {
  readonly session: ConversationSession
  readonly customerId: string
  readonly channel: string
  readonly items: readonly ParsedListItem[]
  readonly rawText: string
  readonly source: ListImportSource
}

export class ProcessParsedListItems {
  constructor(private readonly dependencies: ProcessParsedListItemsDependencies) {}

  async execute(params: ProcessParsedListItemsParams): Promise<void> {
    const matchResults = await Promise.all(
      params.items.map((item) => this.dependencies.matchProductsUseCase.execute({ item })),
    )

    const existingContext = (params.session.context ?? {}) as ConversationContext
    const cartDraft: CartDraftItem[] = [...(existingContext.cartDraft ?? [])]
    const unmatchedTerms: string[] = [...(existingContext.unmatchedTerms ?? [])]
    const pendingResolutions: PendingResolution[] = [...(existingContext.pendingResolutions ?? [])]

    let matchedCount = 0
    let ambiguousCount = 0
    let unmatchedCount = 0

    for (const result of matchResults) {
      if (result.matchType === MATCH_TYPE.AUTO) {
        const candidate = result.candidates[0]!
        cartDraft.push({
          productId: candidate.productId,
          name: candidate.name,
          priceInCents: candidate.priceInCents,
          quantity: result.item.quantity,
          matchType: 'auto',
          originalTerm: result.item.term,
        })
        matchedCount += 1
        continue
      }

      if (result.matchType === MATCH_TYPE.NOT_FOUND) {
        unmatchedTerms.push(result.item.term)
        unmatchedCount += 1
        continue
      }

      pendingResolutions.push({
        originalTerm: result.item.term,
        quantity: result.item.quantity,
        unit: result.item.unit,
        candidates: result.candidates,
      })
      ambiguousCount += 1
    }

    await this.dependencies.listImportRepository.create({
      id: generateId(),
      sessionId: params.session.id,
      source: params.source,
      rawText: params.rawText,
      parseResult: matchResults,
      matchedCount,
      ambiguousCount,
      unmatchedCount,
    })

    await advanceResolutionQueue({
      session: params.session,
      customerId: params.customerId,
      channel: params.channel,
      context: { cartDraft, unmatchedTerms, pendingResolutions },
      conversationSessionRepository: this.dependencies.conversationSessionRepository,
      whatsAppSender: this.dependencies.whatsAppSender,
      cartRepository: this.dependencies.cartRepository,
      productRepository: this.dependencies.productRepository,
      addCartItemUseCase: this.dependencies.addCartItemUseCase,
    })
  }
}
