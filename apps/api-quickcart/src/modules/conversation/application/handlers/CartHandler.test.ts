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

import { CartHandler, type CartHandlerDependencies } from '@/modules/conversation/application/handlers/CartHandler'
import type { ConversationHandlerContext } from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { EDITING_CART_ROW_ID, EDITING_CART_ROW_PREFIX } from '@/modules/conversation/shared/Messages.constant'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'

const CUSTOMER_PHONE = '5511999990000'

function buildCartItems(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: `item-${index}`, productId: `product-${index}`, quantity: 1 }))
}

function buildHarness(itemCount: number) {
  const sentLists: { readonly rowIds: readonly string[] }[] = []
  const updatedContexts: ConversationContext[] = []

  const dependencies = {
    conversationSessionRepository: {
      updateStateByPhone: async (params: { context: ConversationContext }) => {
        updatedContexts.push(params.context)
      },
    },
    whatsAppSender: {
      sendText: async () => undefined,
      sendInteractiveList: async (
        _to: string,
        _bodyText: string,
        _buttonText: string,
        sections: readonly { rows: readonly { id: string }[] }[],
      ) => {
        sentLists.push({ rowIds: sections.flatMap((section) => section.rows.map((row) => row.id)) })
      },
    },
    cartRepository: {
      findOpenByCustomer: async () => ({ id: 'cart-1' }),
      listItems: async () => buildCartItems(itemCount),
    },
    productRepository: {
      findById: async (productId: string) => ({ id: productId, name: `Produto ${productId}`, priceInCents: 1_000 }),
    },
    removeCartItemUseCase: {},
    updateCartItemQuantityUseCase: {},
  } as unknown as CartHandlerDependencies

  return { handler: new CartHandler(dependencies), sentLists, updatedContexts }
}

function buildContext(
  message: ParsedInboundMessage,
  context: ConversationContext = {},
  currentState: string = CONVERSATION_STATE.EDITING_CART,
): ConversationHandlerContext {
  return {
    session: { customerPhone: CUSTOMER_PHONE, currentState, context },
    customer: { id: 'customer-1' },
    message,
  } as unknown as ConversationHandlerContext
}

function buildListReply(listId: string): ParsedInboundMessage {
  return { kind: 'list_reply', from: CUSTOMER_PHONE, waMessageId: 'wamid-1', listId, listTitle: listId }
}

describe('CartHandler — edição paginada', () => {
  it('pagina a lista de edição quando os itens passam do teto, sem "anterior" na primeira página', async () => {
    const harness = buildHarness(12)

    await harness.handler.handle(
      buildContext(
        { kind: 'button_reply', from: CUSTOMER_PHONE, waMessageId: 'w', buttonId: 'edit_cart', buttonTitle: 'Editar' },
        {},
        CONVERSATION_STATE.CART_REVIEW,
      ),
    )

    expect(harness.sentLists[0]?.rowIds.length).toBeLessThanOrEqual(10)
    expect(harness.sentLists[0]?.rowIds.at(-1)).toBe(EDITING_CART_ROW_ID.NEXT_PAGE)
    expect(harness.sentLists[0]?.rowIds).not.toContain(EDITING_CART_ROW_ID.PREVIOUS_PAGE)
  })

  it('avança de página ao tocar em próxima página, chega na última com "anterior" e sem repetir "próxima"', async () => {
    const harness = buildHarness(12)

    await harness.handler.handle(
      buildContext(buildListReply(EDITING_CART_ROW_ID.NEXT_PAGE), { editingCartPage: 1 }),
    )

    expect(harness.sentLists[0]?.rowIds).not.toContain(EDITING_CART_ROW_ID.NEXT_PAGE)
    expect(harness.sentLists[0]?.rowIds).toContain(EDITING_CART_ROW_ID.PREVIOUS_PAGE)
    expect(harness.sentLists[0]?.rowIds).toContain(EDITING_CART_ROW_ID.DONE)
    expect(harness.sentLists[0]?.rowIds.length).toBeLessThanOrEqual(10)
    expect(harness.updatedContexts.at(-1)).toEqual({ editingCartPage: 2 })
  })

  it('volta para a primeira página ao tocar em anterior, com o mesmo conteúdo de antes (round-trip)', async () => {
    const harness = buildHarness(12)

    await harness.handler.handle(
      buildContext(
        { kind: 'button_reply', from: CUSTOMER_PHONE, waMessageId: 'w', buttonId: 'edit_cart', buttonTitle: 'Editar' },
        {},
        CONVERSATION_STATE.CART_REVIEW,
      ),
    )
    const firstPageRowIds = harness.sentLists[0]?.rowIds

    await harness.handler.handle(buildContext(buildListReply(EDITING_CART_ROW_ID.NEXT_PAGE), { editingCartPage: 1 }))
    await harness.handler.handle(buildContext(buildListReply(EDITING_CART_ROW_ID.PREVIOUS_PAGE), { editingCartPage: 2 }))

    expect(harness.sentLists.at(-1)?.rowIds).toEqual(firstPageRowIds)
    expect(harness.updatedContexts.at(-1)).toEqual({ editingCartPage: 1 })
  })

  it('nunca passa do teto de 10 linhas e alcança todos os itens exatamente uma vez', async () => {
    const harness = buildHarness(12)

    await harness.handler.handle(
      buildContext(
        { kind: 'button_reply', from: CUSTOMER_PHONE, waMessageId: 'w', buttonId: 'edit_cart', buttonTitle: 'Editar' },
        {},
        CONVERSATION_STATE.CART_REVIEW,
      ),
    )
    await harness.handler.handle(buildContext(buildListReply(EDITING_CART_ROW_ID.NEXT_PAGE), { editingCartPage: 1 }))

    for (const sentList of harness.sentLists) {
      expect(sentList.rowIds.length).toBeLessThanOrEqual(10)
    }

    const firstPageItemIds = harness.sentLists[0]?.rowIds.filter((id) => id.startsWith(EDITING_CART_ROW_PREFIX.ITEM)) ?? []
    const secondPageItemIds = harness.sentLists[1]?.rowIds.filter((id) => id.startsWith(EDITING_CART_ROW_PREFIX.ITEM)) ?? []

    expect(firstPageItemIds.length + secondPageItemIds.length).toBe(12)
    expect(new Set([...firstPageItemIds, ...secondPageItemIds]).size).toBe(12)
  })
})
