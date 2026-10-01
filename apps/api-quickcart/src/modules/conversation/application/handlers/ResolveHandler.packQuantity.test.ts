/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cobre o caminho de desambiguação: tocar em "Arroz 5kg" depois de pedir 5kg tem que
 * virar quantidade 1, não 5 — a mesma regra de pacote do match automático, aplicada
 * no momento da escolha (ver `resolvePackQuantity`).
 */

import { describe, expect, it } from 'bun:test'

import { ResolveHandler, type ResolveHandlerDependencies } from '@/modules/conversation/application/handlers/ResolveHandler'
import type { ConversationHandlerContext } from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { RESOLVE_ROW_ID, RESOLVE_ROW_PREFIX } from '@/modules/conversation/shared/Messages.constant'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'

const CUSTOMER_PHONE = '5511999990000'

function buildHarness() {
  const addedItems: { readonly productId: string; readonly quantity: number }[] = []
  const updatedContexts: ConversationContext[] = []

  const dependencies = {
    conversationSessionRepository: {
      updateStateByPhone: async (params: { context: ConversationContext }) => {
        updatedContexts.push(params.context)
      },
    },
    whatsAppSender: {
      sendText: async () => undefined,
      sendInteractiveList: async () => undefined,
      sendInteractiveButtons: async () => undefined,
    },
    cartRepository: {
      findOpenByCustomer: async () => undefined,
      listItems: async () => [],
    },
    productRepository: {
      findById: async () => undefined,
    },
    addCartItemUseCase: {
      execute: async (params: { productId: string; quantity: number }) => {
        addedItems.push({ productId: params.productId, quantity: params.quantity })
        return { cart: { id: 'cart-1' } }
      },
    },
  } as unknown as ResolveHandlerDependencies

  return { handler: new ResolveHandler(dependencies), addedItems, updatedContexts }
}

function buildContext(message: ParsedInboundMessage, context: ConversationContext): ConversationHandlerContext {
  return {
    session: { customerPhone: CUSTOMER_PHONE, currentState: CONVERSATION_STATE.RESOLVING_ITEMS, context },
    customer: { id: 'customer-1' },
    message,
  } as unknown as ConversationHandlerContext
}

function buildListReply(listId: string): ParsedInboundMessage {
  return { kind: 'list_reply', from: CUSTOMER_PHONE, waMessageId: 'wamid-1', listId, listTitle: listId }
}

describe('ResolveHandler — quantidade de pacote na escolha da lista', () => {
  it('tocar no candidato de 5kg depois de pedir 5kg adiciona 1 unidade, não 5', async () => {
    const harness = buildHarness()
    const context: ConversationContext = {
      pendingResolutions: [
        {
          originalTerm: 'arroz tio joao',
          quantity: 5,
          unit: 'kg',
          candidates: [
            { productId: 'p-1kg', name: 'Arroz Tio João 1kg', brand: null, unitSize: '1kg', priceInCents: 1500, score: 0.7 },
            { productId: 'p-5kg', name: 'Arroz Tio João 5kg', brand: null, unitSize: '5kg', priceInCents: 6000, score: 0.65 },
          ],
        },
      ],
    }

    await harness.handler.handle(buildContext(buildListReply(`${RESOLVE_ROW_PREFIX.PRODUCT}p-5kg`), context))

    expect(harness.addedItems).toEqual([{ productId: 'p-5kg', quantity: 1 }])
  })

  it('tocar no candidato de 1kg depois de pedir 5kg adiciona 5 unidades', async () => {
    const harness = buildHarness()
    const context: ConversationContext = {
      pendingResolutions: [
        {
          originalTerm: 'arroz tio joao',
          quantity: 5,
          unit: 'kg',
          candidates: [
            { productId: 'p-1kg', name: 'Arroz Tio João 1kg', brand: null, unitSize: '1kg', priceInCents: 1500, score: 0.7 },
          ],
        },
      ],
    }

    await harness.handler.handle(buildContext(buildListReply(`${RESOLVE_ROW_PREFIX.PRODUCT}p-1kg`), context))

    expect(harness.addedItems).toEqual([{ productId: 'p-1kg', quantity: 5 }])
  })

  it('"tanto faz" (mais barato) também aplica a regra de pacote', async () => {
    const harness = buildHarness()
    const context: ConversationContext = {
      pendingResolutions: [
        {
          originalTerm: 'leite',
          quantity: 2,
          unit: 'l',
          candidates: [
            { productId: 'p-1l-marca-a', name: 'Leite Integral 1L', brand: 'Marca A', unitSize: '1L', priceInCents: 500, score: 0.7 },
            { productId: 'p-1l-marca-b', name: 'Leite Integral 1L', brand: 'Marca B', unitSize: '1L', priceInCents: 480, score: 0.68 },
          ],
        },
      ],
    }

    await harness.handler.handle(buildContext(buildListReply(RESOLVE_ROW_ID.CHEAPEST), context))

    expect(harness.addedItems).toEqual([{ productId: 'p-1l-marca-b', quantity: 2 }])
  })

  it('unidade de contagem não é afetada: 3 pacotes de café continuam 3, mesmo com unitSize em peso', async () => {
    const harness = buildHarness()
    const context: ConversationContext = {
      pendingResolutions: [
        {
          originalTerm: 'cafe',
          quantity: 3,
          unit: 'pacotes',
          candidates: [
            { productId: 'p-cafe-500g', name: 'Café 500g', brand: null, unitSize: '500g', priceInCents: 900, score: 0.7 },
          ],
        },
      ],
    }

    await harness.handler.handle(buildContext(buildListReply(`${RESOLVE_ROW_PREFIX.PRODUCT}p-cafe-500g`), context))

    expect(harness.addedItems).toEqual([{ productId: 'p-cafe-500g', quantity: 3 }])
  })
})
