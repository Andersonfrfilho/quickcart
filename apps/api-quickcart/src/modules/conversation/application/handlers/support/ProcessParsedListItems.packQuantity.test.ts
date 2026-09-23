/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Caminho automático: "5 kg de arroz" tem que virar 1 unidade do pacote de 5kg quando ele
 * existe no catálogo, não 5 unidades do pacote de 1kg (caso real de staging que gerou esta regra).
 */

import { describe, expect, it } from 'bun:test'

import {
  ProcessParsedListItems,
  type ProcessParsedListItemsDependencies,
} from '@/modules/conversation/application/handlers/support/ProcessParsedListItems'
import { LIST_IMPORT_SOURCE } from '@/modules/conversation/shared/ListImport.constant'
import { CHANNEL } from '@/modules/shared/shared.constant'

function buildHarness() {
  const addedItems: { readonly productId: string; readonly quantity: number }[] = []

  const dependencies = {
    matchProductsUseCase: {
      execute: async ({ item }: { item: { term: string; quantity: number; unit: string } }) => ({
        item,
        matchType: 'auto',
        candidates: [
          { productId: 'p-5kg', name: 'Arroz Tio João 5kg', brand: null, unitSize: '5kg', priceInCents: 6000, score: 0.9 },
        ],
      }),
    },
    conversationSessionRepository: {
      updateStateByPhone: async () => undefined,
    },
    whatsAppSender: {
      sendText: async () => undefined,
      sendInteractiveButtons: async () => undefined,
    },
    listImportRepository: {
      create: async () => undefined,
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
  } as unknown as ProcessParsedListItemsDependencies

  return { processor: new ProcessParsedListItems(dependencies), addedItems }
}

describe('ProcessParsedListItems — quantidade de pacote no match automático', () => {
  it('5kg pedidos casando direto com o pacote de 5kg adiciona 1 unidade, não 5', async () => {
    const harness = buildHarness()

    await harness.processor.execute({
      session: { id: 'session-1', context: {} } as never,
      customerId: 'customer-1',
      channel: CHANNEL.WHATSAPP,
      items: [{ term: 'arroz tio joao', quantity: 5, unit: 'kg' }],
      rawText: '5kg de arroz tio joao',
      source: LIST_IMPORT_SOURCE.TEXT,
    })

    expect(harness.addedItems).toEqual([{ productId: 'p-5kg', quantity: 1 }])
  })
})
