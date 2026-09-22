/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { describe, expect, it } from 'bun:test'

import type { ProductSearchResult } from '@/modules/catalog/domain/ProductRepository.interface'
import { BrowseHandler, type BrowseHandlerDependencies } from '@/modules/conversation/application/handlers/BrowseHandler'
import type { ConversationHandlerContext } from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { BROWSE_ROW_PREFIX, MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'

const CUSTOMER_PHONE = '5511999990000'

type SentList = { readonly bodyText: string; readonly rowIds: readonly string[] }

type Harness = {
  readonly handler: BrowseHandler
  readonly sentTexts: string[]
  readonly sentLists: SentList[]
  readonly searchedTerms: string[]
}

function buildSearchResult(overrides: Partial<ProductSearchResult>): ProductSearchResult {
  return { id: 'product-1', name: 'Arroz Tio João 5kg', brand: null, unitSize: null, priceInCents: 2990, score: 0.9, ...overrides }
}

function buildHarness(searchResults: readonly ProductSearchResult[]): Harness {
  const sentTexts: string[] = []
  const sentLists: SentList[] = []
  const searchedTerms: string[] = []

  const dependencies = {
    conversationSessionRepository: { updateStateByPhone: async () => undefined },
    whatsAppSender: {
      sendText: async (_to: string, body: string) => {
        sentTexts.push(body)
      },
      sendInteractiveList: async (
        _to: string,
        bodyText: string,
        _buttonText: string,
        sections: readonly { rows: readonly { id: string }[] }[],
      ) => {
        sentLists.push({ bodyText, rowIds: sections.flatMap((section) => section.rows.map((row) => row.id)) })
      },
    },
    productRepository: {
      searchByTerm: async (term: string) => {
        searchedTerms.push(term)
        return [...searchResults]
      },
    },
    cartRepository: {},
    addCartItemUseCase: {},
  } as unknown as BrowseHandlerDependencies

  return { handler: new BrowseHandler(dependencies), sentTexts, sentLists, searchedTerms }
}

function buildContext(message: ParsedInboundMessage): ConversationHandlerContext {
  return {
    session: { customerPhone: CUSTOMER_PHONE, currentState: CONVERSATION_STATE.BROWSING_CATEGORIES, context: {} },
    customer: { id: 'customer-1' },
    message,
  } as unknown as ConversationHandlerContext
}

function buildTextMessage(body: string): ParsedInboundMessage {
  return { kind: 'text', from: CUSTOMER_PHONE, waMessageId: 'wamid-1', body }
}

describe('BrowseHandler — texto livre ao navegar', () => {
  it('busca o termo digitado e envia os produtos encontrados como lista selecionável', async () => {
    const harness = buildHarness([buildSearchResult({ id: 'rice-1' }), buildSearchResult({ id: 'rice-2', name: 'Arroz Camil 1kg' })])

    await harness.handler.handle(buildContext(buildTextMessage('  arroz ')))

    expect(harness.searchedTerms).toEqual(['arroz'])
    expect(harness.sentTexts).toEqual([])
    expect(harness.sentLists).toEqual([
      {
        bodyText: MESSAGES.BROWSE_SEARCH_RESULTS.replace('{termo}', 'arroz'),
        rowIds: [`${BROWSE_ROW_PREFIX.PRODUCT}rice-1`, `${BROWSE_ROW_PREFIX.PRODUCT}rice-2`],
      },
    ])
  })

  it('descarta resultados abaixo do score mínimo', async () => {
    const harness = buildHarness([buildSearchResult({ id: 'rice-1' }), buildSearchResult({ id: 'soap-1', score: 0.1 })])

    await harness.handler.handle(buildContext(buildTextMessage('arroz')))

    expect(harness.sentLists[0]?.rowIds).toEqual([`${BROWSE_ROW_PREFIX.PRODUCT}rice-1`])
  })

  it('avisa quando nada casa com o termo, sem enviar lista', async () => {
    const harness = buildHarness([buildSearchResult({ score: 0.1 })])

    await harness.handler.handle(buildContext(buildTextMessage('xpto')))

    expect(harness.sentLists).toEqual([])
    expect(harness.sentTexts).toEqual([MESSAGES.BROWSE_SEARCH_NOT_FOUND.replace('{termo}', 'xpto')])
  })

  it('continua rejeitando entrada que não é texto nem toque na lista', async () => {
    const harness = buildHarness([])

    await harness.handler.handle(
      buildContext({ kind: 'button_reply', from: CUSTOMER_PHONE, waMessageId: 'wamid-2', buttonId: 'any' } as ParsedInboundMessage),
    )

    expect(harness.searchedTerms).toEqual([])
    expect(harness.sentTexts).toEqual([MESSAGES.BROWSE_UNEXPECTED_INPUT])
  })
})
