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
import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import {
  BROWSE_POST_ADD_BUTTON_ID,
  BROWSE_ROW_ID,
  BROWSE_ROW_PREFIX,
  MESSAGES,
} from '@/modules/conversation/shared/Messages.constant'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'

const CUSTOMER_PHONE = '5511999990000'

type SentList = { readonly bodyText: string; readonly rowIds: readonly string[] }
type SentButtons = { readonly bodyText: string; readonly buttonIds: readonly string[] }

type HarnessOverrides = {
  readonly cartDraft?: ConversationContext['cartDraft']
  readonly cartId?: string
  readonly openCartId?: string
}

type Harness = {
  readonly handler: BrowseHandler
  readonly sentTexts: string[]
  readonly sentLists: SentList[]
  readonly sentButtons: SentButtons[]
  readonly searchedTerms: string[]
  readonly updatedContexts: ConversationContext[]
  readonly listedCategories: number
  readonly addedCartItems: string[]
}

function buildSearchResult(overrides: Partial<ProductSearchResult>): ProductSearchResult {
  return { id: 'product-1', name: 'Arroz Tio João 5kg', brand: null, unitSize: null, priceInCents: 2990, score: 0.9, ...overrides }
}

function buildHarness(searchResults: readonly ProductSearchResult[], overrides: HarnessOverrides = {}): Harness {
  const sentTexts: string[] = []
  const sentLists: SentList[] = []
  const sentButtons: SentButtons[] = []
  const searchedTerms: string[] = []
  const updatedContexts: ConversationContext[] = []
  const addedCartItems: string[] = []
  let listedCategories = 0

  const dependencies = {
    conversationSessionRepository: {
      updateStateByPhone: async (params: { context: ConversationContext }) => {
        updatedContexts.push(params.context)
      },
    },
    whatsAppSender: {
      sendText: async (_to: string, body: string) => {
        sentTexts.push(body)
      },
      sendInteractiveButtons: async (_to: string, bodyText: string, buttons: readonly { id: string }[]) => {
        sentButtons.push({ bodyText, buttonIds: buttons.map((button) => button.id) })
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
      findById: async (id: string) => ({ id, name: 'Arroz Tio João 5kg', priceInCents: 2990 }),
      list: async () => ({ items: [{ id: 'product-2', name: 'Feijão Carioca 1kg', priceInCents: 890 }], total: 1 }),
    },
    categoryRepository: {
      list: async () => {
        listedCategories += 1
        return [{ id: 'category-1', name: 'Mercearia', emoji: '🛒' }]
      },
    },
    cartRepository: {
      findOpenByCustomer: async () => (overrides.openCartId ? { id: overrides.openCartId } : undefined),
      listItems: async () => (overrides.cartDraft ?? []).map((item) => ({ productId: item.productId, quantity: item.quantity })),
    },
    addCartItemUseCase: {
      execute: async (params: { productId: string }) => {
        addedCartItems.push(params.productId)
        return { cart: { id: overrides.cartId ?? 'cart-1' } }
      },
    },
  } as unknown as BrowseHandlerDependencies

  return {
    handler: new BrowseHandler(dependencies),
    sentTexts,
    sentLists,
    sentButtons,
    searchedTerms,
    updatedContexts,
    get listedCategories() {
      return listedCategories
    },
    addedCartItems,
  }
}

function buildContext(message: ParsedInboundMessage, context: ConversationContext = {}): ConversationHandlerContext {
  return {
    session: { customerPhone: CUSTOMER_PHONE, currentState: CONVERSATION_STATE.BROWSING_CATEGORIES, context },
    customer: { id: 'customer-1' },
    message,
  } as unknown as ConversationHandlerContext
}

function buildTextMessage(body: string): ParsedInboundMessage {
  return { kind: 'text', from: CUSTOMER_PHONE, waMessageId: 'wamid-1', body }
}

function buildListReply(listId: string): ParsedInboundMessage {
  return { kind: 'list_reply', from: CUSTOMER_PHONE, waMessageId: 'wamid-3', listId, listTitle: listId }
}

function buildButtonReply(buttonId: string): ParsedInboundMessage {
  return { kind: 'button_reply', from: CUSTOMER_PHONE, waMessageId: 'wamid-4', buttonId, buttonTitle: buttonId }
}

function buildManySearchResults(count: number): ProductSearchResult[] {
  return Array.from({ length: count }, (_, index) => buildSearchResult({ id: `rice-${index}`, name: `Arroz ${index}` }))
}

function buildAwaitingQuantityContext(message: ParsedInboundMessage, context: ConversationContext): ConversationHandlerContext {
  return {
    session: { customerPhone: CUSTOMER_PHONE, currentState: CONVERSATION_STATE.AWAITING_QUANTITY, context },
    customer: { id: 'customer-1' },
    message,
  } as unknown as ConversationHandlerContext
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

  it('pagina a busca: primeira página tem 8 produtos + próxima página, sem anterior', async () => {
    const harness = buildHarness(buildManySearchResults(12))

    await harness.handler.handle(buildContext(buildTextMessage('arroz')))

    expect(harness.sentLists[0]?.rowIds).toHaveLength(9)
    expect(harness.sentLists[0]?.rowIds.at(-1)).toBe(BROWSE_ROW_ID.NEXT_SEARCH_PAGE)
    expect(harness.sentLists[0]?.rowIds).not.toContain(BROWSE_ROW_ID.PREVIOUS_SEARCH_PAGE)
    expect(harness.updatedContexts.at(-1)).toEqual({ browsingSearchTerm: 'arroz', browsingSearchPage: 1 })
  })

  it('avança para a última página da busca ao tocar em próxima página, com anterior e sem repetir a navegação', async () => {
    const harness = buildHarness(buildManySearchResults(12))

    await harness.handler.handle(
      buildContext(buildListReply(BROWSE_ROW_ID.NEXT_SEARCH_PAGE), { browsingSearchTerm: 'arroz', browsingSearchPage: 1 }),
    )

    expect(harness.searchedTerms).toEqual(['arroz'])
    expect(harness.sentLists[0]?.rowIds).toHaveLength(5)
    expect(harness.sentLists[0]?.rowIds).not.toContain(BROWSE_ROW_ID.NEXT_SEARCH_PAGE)
    expect(harness.sentLists[0]?.rowIds).toContain(BROWSE_ROW_ID.PREVIOUS_SEARCH_PAGE)
    expect(harness.updatedContexts.at(-1)).toEqual({ browsingSearchTerm: 'arroz', browsingSearchPage: 2 })
  })

  it('volta para a primeira página da busca ao tocar em anterior, com o mesmo conteúdo de antes', async () => {
    const harness = buildHarness(buildManySearchResults(12))

    await harness.handler.handle(buildContext(buildTextMessage('arroz')))
    const firstPageRowIds = harness.sentLists[0]?.rowIds

    await harness.handler.handle(
      buildContext(buildListReply(BROWSE_ROW_ID.NEXT_SEARCH_PAGE), { browsingSearchTerm: 'arroz', browsingSearchPage: 1 }),
    )
    await harness.handler.handle(
      buildContext(buildListReply(BROWSE_ROW_ID.PREVIOUS_SEARCH_PAGE), { browsingSearchTerm: 'arroz', browsingSearchPage: 2 }),
    )

    expect(harness.sentLists.at(-1)?.rowIds).toEqual(firstPageRowIds)
  })
})

describe('BrowseHandler — depois de adicionar um produto', () => {
  it('envia os 3 botões de "e agora?" e NÃO reenvia a lista de produtos', async () => {
    const harness = buildHarness([])

    await harness.handler.handle(
      buildAwaitingQuantityContext(buildTextMessage('3'), {
        awaitingQuantityProduct: { productId: 'product-1', name: 'Arroz Tio João 5kg', priceInCents: 2990 },
        browsingCategoryId: 'category-1',
        browsingPage: 2,
      }),
    )

    expect(harness.sentLists).toEqual([])
    expect(harness.sentButtons).toHaveLength(1)
    expect(harness.sentButtons[0]?.bodyText).toBe('✅ Adicionado: 3× Arroz Tio João 5kg. E agora?')
    expect(harness.sentButtons[0]?.buttonIds).toEqual([
      BROWSE_POST_ADD_BUTTON_ID.MORE_CATEGORY,
      BROWSE_POST_ADD_BUTTON_ID.OTHER_CATEGORY,
      BROWSE_POST_ADD_BUTTON_ID.VIEW_CART,
    ])
  })

  it('mantém o contexto de navegação (categoria/página) e o carrinho no rascunho', async () => {
    const harness = buildHarness([])

    await harness.handler.handle(
      buildAwaitingQuantityContext(buildTextMessage('3'), {
        awaitingQuantityProduct: { productId: 'product-1', name: 'Arroz Tio João 5kg', priceInCents: 2990 },
        browsingCategoryId: 'category-1',
        browsingPage: 2,
        rememberedCheckout: { deliveryType: 'delivery', paymentMethod: 'pix', receiptPreference: 'none' },
      }),
    )

    expect(harness.updatedContexts.at(-1)).toMatchObject({
      browsingCategoryId: 'category-1',
      browsingPage: 2,
      rememberedCheckout: { deliveryType: 'delivery', paymentMethod: 'pix', receiptPreference: 'none' },
      cartDraft: [
        {
          productId: 'product-1',
          name: 'Arroz Tio João 5kg',
          priceInCents: 2990,
          quantity: 3,
          matchType: 'manual',
          originalTerm: 'Arroz Tio João 5kg',
        },
      ],
    })
  })
})

describe('BrowseHandler — botões pós-adição', () => {
  it('"Mais desta categoria" reenvia a lista da MESMA página em que o cliente estava', async () => {
    const harness = buildHarness([])

    await harness.handler.handle(
      buildContext(buildButtonReply(BROWSE_POST_ADD_BUTTON_ID.MORE_CATEGORY), {
        browsingCategoryId: 'category-1',
        browsingPage: 2,
      }),
    )

    expect(harness.sentLists).toHaveLength(1)
    expect(harness.sentLists[0]?.bodyText).toBe(MESSAGES.BROWSE_PICK_PRODUCT)
    expect(harness.listedCategories).toBe(0)
  })

  it('"Outra categoria" envia a lista de categorias', async () => {
    const harness = buildHarness([])

    await harness.handler.handle(buildContext(buildButtonReply(BROWSE_POST_ADD_BUTTON_ID.OTHER_CATEGORY)))

    expect(harness.listedCategories).toBe(1)
    expect(harness.sentLists).toHaveLength(1)
    expect(harness.sentLists[0]?.bodyText).toBe(MESSAGES.BROWSE_PICK_CATEGORY)
  })

  it('"Ver carrinho" chama o MESMO caminho do gatilho de texto "carrinho"', async () => {
    const cartDraftItem = {
      productId: 'product-1',
      name: 'Arroz Tio João 5kg',
      priceInCents: 2990,
      quantity: 3,
      matchType: 'manual' as const,
      originalTerm: 'Arroz Tio João 5kg',
    }

    const viaButton = buildHarness([], { cartDraft: [cartDraftItem] })
    await viaButton.handler.handle(
      buildContext(buildButtonReply(BROWSE_POST_ADD_BUTTON_ID.VIEW_CART), { cartDraft: [cartDraftItem] }),
    )

    const viaTrigger = buildHarness([], { cartDraft: [cartDraftItem] })
    await viaTrigger.handler.handle(buildContext(buildTextMessage('carrinho'), { cartDraft: [cartDraftItem] }))

    expect(viaButton.addedCartItems).toEqual(['product-1'])
    expect(viaButton.addedCartItems).toEqual(viaTrigger.addedCartItems)
    expect(viaButton.sentButtons).toEqual(viaTrigger.sentButtons)
    expect(viaButton.updatedContexts.at(-1)).toEqual(viaTrigger.updatedContexts.at(-1))
  })

  it('carrinho vazio + "Ver carrinho": mesmo aviso do gatilho "carrinho" hoje', async () => {
    const viaButton = buildHarness([])
    await viaButton.handler.handle(buildContext(buildButtonReply(BROWSE_POST_ADD_BUTTON_ID.VIEW_CART)))

    const viaTrigger = buildHarness([])
    await viaTrigger.handler.handle(buildContext(buildTextMessage('carrinho')))

    expect(viaButton.sentTexts).toEqual([MESSAGES.CART_EMPTY])
    expect(viaButton.sentTexts).toEqual(viaTrigger.sentTexts)
  })
})

describe('BrowseHandler — frases de encerramento levam ao carrinho (relato do cliente preso em "Não")', () => {
  const CART_DONE_PHRASES = ['Não', 'não', 'pronto', 'Só isso!', 'é só isso', 'finalizar', 'concluir', 'fechar pedido']

  for (const phrase of CART_DONE_PHRASES) {
    it(`"${phrase}" leva ao carrinho, e não à busca de produto`, async () => {
      const harness = buildHarness([])

      await harness.handler.handle(buildContext(buildTextMessage(phrase)))

      expect(harness.searchedTerms).toEqual([])
      expect(harness.sentTexts).toEqual([MESSAGES.CART_EMPTY])
    })
  }

  it('"não tem arroz integral?" continua sendo busca de produto, não é engolido pelo encerramento', async () => {
    const harness = buildHarness([buildSearchResult({ id: 'rice-1' })])

    await harness.handler.handle(buildContext(buildTextMessage('não tem arroz integral?')))

    expect(harness.searchedTerms).toEqual(['não tem arroz integral?'])
    expect(harness.sentTexts).toEqual([])
  })

  it('reproduz o cenário do relato: produto → 3 → "Não" → resumo do carrinho, sem "Não encontrei \'Não\'"', async () => {
    const harness = buildHarness([])

    await harness.handler.handle(
      buildContext(buildListReply(`${BROWSE_ROW_PREFIX.PRODUCT}product-1`), { browsingCategoryId: 'category-1', browsingPage: 1 }),
    )
    const contextAfterPick = harness.updatedContexts.at(-1) as ConversationContext

    await harness.handler.handle(buildAwaitingQuantityContext(buildTextMessage('3'), contextAfterPick))
    const contextAfterAdd = harness.updatedContexts.at(-1) as ConversationContext

    await harness.handler.handle(buildContext(buildTextMessage('Não'), contextAfterAdd))

    expect(harness.sentTexts.some((text) => text.includes('Não encontrei'))).toBe(false)
    expect(harness.sentTexts.at(-1)).toBe(MESSAGES.CART_EMPTY)
    expect(harness.searchedTerms).toEqual([])
  })
})
