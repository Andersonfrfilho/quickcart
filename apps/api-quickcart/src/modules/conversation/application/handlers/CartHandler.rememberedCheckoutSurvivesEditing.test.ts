/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * T2.3 — correção: quem aperta "Alterar" quer mudar o CARRINHO, e as transições do ciclo de
 * montagem/edição ("Adicionar mais", editar item, "Concluir edição") gravavam `context: {}`,
 * apagando junto o `rememberedCheckout` guardado pelo "Alterar". Este arquivo cobre as
 * transições do próprio CartHandler; `enterCartReview`/`advanceResolutionQueue` (caminho
 * "Adicionar mais" → lista → resolução) têm cobertura em
 * `support/carryRememberedCheckout.enterCartReview.test.ts`.
 */

import { describe, expect, it } from 'bun:test'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { Customer } from '@/infra/database/schema'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { CART_REVIEW_BUTTON_ID, DELIVERY_TYPE_BUTTON_ID, EDITING_CART_ROW_ID, EDITING_CART_ROW_PREFIX, PAYMENT_METHOD_BUTTON_ID, RECEIPT_PREFERENCE_BUTTON_ID } from '@/modules/conversation/shared/Messages.constant'
import { CartHandler, type CartHandlerDependencies } from './CartHandler'

const PHONE = '5511988887777'
const CUSTOMER_ID = 'customer-1'
const CART_ID = 'cart-1'

const CUSTOMER: Customer = {
  id: CUSTOMER_ID,
  phone: PHONE,
  name: 'Cliente Teste',
  email: null,
  userId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const REMEMBERED = {
  deliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY,
  paymentMethod: PAYMENT_METHOD_BUTTON_ID.CASH,
  receiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP,
}

function buildSession(overrides: Partial<ConversationSession> = {}): ConversationSession {
  return {
    id: 'session-1',
    customerPhone: PHONE,
    currentState: CONVERSATION_STATE.CART_REVIEW,
    context: { rememberedCheckout: REMEMBERED },
    mode: 'bot',
    lastInteractionAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

type StateUpdate = { currentState: string; context: Record<string, unknown> }

function buildDependencies(hasCart = true) {
  const stateUpdates: StateUpdate[] = []

  const dependencies = {
    conversationSessionRepository: {
      async updateStateByPhone(params: { currentState: string; context: Record<string, unknown> }) {
        stateUpdates.push({ currentState: params.currentState, context: params.context ?? {} })
        return undefined
      },
    },
    whatsAppSender: {
      async sendText() {},
      async sendInteractiveButtons() {},
      async sendInteractiveList() {},
    },
    cartRepository: {
      async findOpenByCustomer() {
        return hasCart ? { id: CART_ID } : undefined
      },
      async listItems() {
        return [{ id: 'item-1', productId: 'product-1', quantity: 2 }]
      },
      async findItemById() {
        return { id: 'item-1', productId: 'product-1', quantity: 2 }
      },
    },
    productRepository: {
      async findById() {
        return { name: 'Arroz 5kg', priceInCents: 5000 }
      },
    },
    removeCartItemUseCase: {},
    updateCartItemQuantityUseCase: {
      async execute() {},
    },
    orderRepository: {
      async findLastByCustomer() {
        return undefined
      },
    },
  } as unknown as CartHandlerDependencies

  return { dependencies, stateUpdates }
}

describe('CartHandler — memória do checkout sobrevive ao ciclo de edição do carrinho (T2.3)', () => {
  it('"Adicionar mais" preserva o rememberedCheckout ao ir para awaiting_list', async () => {
    const { dependencies, stateUpdates } = buildDependencies()
    const handler = new CartHandler(dependencies)

    await handler.handle({
      session: buildSession(),
      customer: CUSTOMER,
      message: {
        kind: 'button_reply',
        from: PHONE,
        waMessageId: 'wa-1',
        buttonId: CART_REVIEW_BUTTON_ID.ADD_MORE,
        buttonTitle: '🛒 Adicionar mais',
      },
    })

    expect(stateUpdates).toEqual([
      { currentState: CONVERSATION_STATE.AWAITING_LIST, context: { rememberedCheckout: REMEMBERED } },
    ])
  })

  it('"Editar carrinho" preserva o rememberedCheckout ao listar itens para edição', async () => {
    const { dependencies, stateUpdates } = buildDependencies()
    const handler = new CartHandler(dependencies)

    await handler.handle({
      session: buildSession(),
      customer: CUSTOMER,
      message: {
        kind: 'button_reply',
        from: PHONE,
        waMessageId: 'wa-1',
        buttonId: CART_REVIEW_BUTTON_ID.EDIT_CART,
        buttonTitle: '✏️ Editar carrinho',
      },
    })

    expect(stateUpdates).toEqual([
      { currentState: CONVERSATION_STATE.EDITING_CART, context: { rememberedCheckout: REMEMBERED, editingCartPage: 1 } },
    ])
  })

  it('editar item e "Concluir edição" preserva o rememberedCheckout ao voltar para cart_review', async () => {
    const { dependencies, stateUpdates } = buildDependencies()
    const handler = new CartHandler(dependencies)

    await handler.handle({
      session: buildSession({
        currentState: CONVERSATION_STATE.EDITING_CART,
        context: { rememberedCheckout: REMEMBERED },
      }),
      customer: CUSTOMER,
      message: {
        kind: 'list_reply',
        from: PHONE,
        waMessageId: 'wa-2',
        listId: EDITING_CART_ROW_ID.DONE,
        listTitle: 'Concluir edição',
      },
    })

    expect(stateUpdates).toEqual([
      { currentState: CONVERSATION_STATE.CART_REVIEW, context: { rememberedCheckout: REMEMBERED } },
    ])
  })

  it('quantidade nova de um item preserva o editingCartItemId e o rememberedCheckout', async () => {
    const { dependencies, stateUpdates } = buildDependencies()
    const handler = new CartHandler(dependencies)

    await handler.handle({
      session: buildSession({
        currentState: CONVERSATION_STATE.EDITING_CART,
        context: { rememberedCheckout: REMEMBERED },
      }),
      customer: CUSTOMER,
      message: {
        kind: 'list_reply',
        from: PHONE,
        waMessageId: 'wa-3',
        listId: `${EDITING_CART_ROW_PREFIX.ITEM}item-1`,
        listTitle: 'Arroz 5kg',
      },
    })

    expect(stateUpdates).toEqual([
      {
        currentState: CONVERSATION_STATE.EDITING_CART,
        context: { rememberedCheckout: REMEMBERED, editingCartItemId: 'item-1' },
      },
    ])
  })

  it('sem "Alterar" antes (sem rememberedCheckout na sessão), editar o carrinho não inventa memória', async () => {
    const { dependencies, stateUpdates } = buildDependencies()
    const handler = new CartHandler(dependencies)

    await handler.handle({
      session: buildSession({ context: {} }),
      customer: CUSTOMER,
      message: {
        kind: 'button_reply',
        from: PHONE,
        waMessageId: 'wa-1',
        buttonId: CART_REVIEW_BUTTON_ID.ADD_MORE,
        buttonTitle: '🛒 Adicionar mais',
      },
    })

    expect(stateUpdates).toEqual([{ currentState: CONVERSATION_STATE.AWAITING_LIST, context: {} }])
  })
})
