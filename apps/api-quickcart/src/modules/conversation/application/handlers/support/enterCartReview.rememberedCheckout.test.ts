/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * T2.3 — correção: `enterCartReview` é o ponto de entrada comum do caminho "Adicionar mais →
 * lista → volta ao carrinho" (via `advanceResolutionQueue`) e do "ver carrinho" do
 * BrowseHandler. Gravava `context: { unmatchedTerms: [] }`, apagando o `rememberedCheckout`
 * guardado pelo "Alterar" mesmo quando a leitura da lista não tinha nada a ver com checkout.
 */

import { describe, expect, it } from 'bun:test'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { DELIVERY_TYPE_BUTTON_ID, PAYMENT_METHOD_BUTTON_ID, RECEIPT_PREFERENCE_BUTTON_ID } from '@/modules/conversation/shared/Messages.constant'
import { advanceResolutionQueue } from './advanceResolutionQueue'
import { enterCartReview, type EnterCartReviewParams } from './enterCartReview'

const PHONE = '5511988887777'
const CUSTOMER_ID = 'customer-1'
const CART_ID = 'cart-1'

const REMEMBERED = {
  deliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY,
  paymentMethod: PAYMENT_METHOD_BUTTON_ID.CASH,
  receiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP,
}

function buildSession(overrides: Partial<ConversationSession> = {}): ConversationSession {
  return {
    id: 'session-1',
    customerPhone: PHONE,
    currentState: CONVERSATION_STATE.AWAITING_LIST,
    context: { rememberedCheckout: REMEMBERED },
    mode: 'bot',
    lastInteractionAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

type StateUpdate = { currentState: string; context: Record<string, unknown> }

function buildDependencies() {
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
      async sendInteractiveList() {},
      async sendInteractiveButtons() {},
    },
    cartRepository: {
      async findOpenByCustomer() {
        return { id: CART_ID }
      },
      async listItems() {
        return [{ productId: 'product-1', quantity: 1 }]
      },
    },
    productRepository: {
      async findById() {
        return { name: 'Arroz 5kg', priceInCents: 5000 }
      },
    },
    addCartItemUseCase: {
      async execute() {
        return { cart: { id: CART_ID } }
      },
    },
  }

  return { dependencies, stateUpdates }
}

describe('enterCartReview — memória do checkout sobrevive à materialização do carrinho (T2.3)', () => {
  it('preserva o rememberedCheckout da sessão ao voltar para cart_review', async () => {
    const { dependencies, stateUpdates } = buildDependencies()

    await enterCartReview({
      session: buildSession(),
      customerId: CUSTOMER_ID,
      channel: 'whatsapp',
      cartDraft: [{ productId: 'product-1', name: 'Arroz 5kg', priceInCents: 5000, quantity: 1, matchType: 'auto', originalTerm: 'arroz' }],
      unmatchedTerms: [],
      ...dependencies,
    } as unknown as EnterCartReviewParams)

    expect(stateUpdates).toEqual([
      {
        currentState: CONVERSATION_STATE.CART_REVIEW,
        context: { unmatchedTerms: [], rememberedCheckout: REMEMBERED },
      },
    ])
  })

  it('caminho completo "Adicionar mais → lista → cart_review" via advanceResolutionQueue preserva a memória', async () => {
    const { dependencies, stateUpdates } = buildDependencies()

    await advanceResolutionQueue({
      session: buildSession(),
      customerId: CUSTOMER_ID,
      channel: 'whatsapp',
      context: {
        cartDraft: [{ productId: 'product-1', name: 'Arroz 5kg', priceInCents: 5000, quantity: 1, matchType: 'auto', originalTerm: 'arroz' }],
        unmatchedTerms: [],
        pendingResolutions: [],
      },
      ...dependencies,
    } as unknown as Parameters<typeof advanceResolutionQueue>[0])

    expect(stateUpdates).toEqual([
      {
        currentState: CONVERSATION_STATE.CART_REVIEW,
        context: { unmatchedTerms: [], rememberedCheckout: REMEMBERED },
      },
    ])
  })

  it('caminho com desambiguação pendente (resolving_items) também preserva a memória', async () => {
    const { dependencies, stateUpdates } = buildDependencies()

    await advanceResolutionQueue({
      session: buildSession(),
      customerId: CUSTOMER_ID,
      channel: 'whatsapp',
      context: {
        cartDraft: [],
        unmatchedTerms: [],
        pendingResolutions: [
          { originalTerm: 'leite', quantity: 1, unit: 'un', candidates: [{ productId: 'p1', name: 'Leite integral', priceInCents: 500 }] },
        ],
      },
      ...dependencies,
    } as unknown as Parameters<typeof advanceResolutionQueue>[0])

    expect(stateUpdates).toEqual([
      {
        currentState: CONVERSATION_STATE.RESOLVING_ITEMS,
        context: {
          cartDraft: [],
          unmatchedTerms: [],
          pendingResolutions: [
            { originalTerm: 'leite', quantity: 1, unit: 'un', candidates: [{ productId: 'p1', name: 'Leite integral', priceInCents: 500 }] },
          ],
          rememberedCheckout: REMEMBERED,
        },
      },
    ])
  })

  it('sem rememberedCheckout na sessão, não inventa memória nenhuma', async () => {
    const { dependencies, stateUpdates } = buildDependencies()

    await enterCartReview({
      session: buildSession({ context: {} }),
      customerId: CUSTOMER_ID,
      channel: 'whatsapp',
      cartDraft: [],
      unmatchedTerms: [],
      ...dependencies,
    } as unknown as EnterCartReviewParams)

    expect(stateUpdates).toEqual([{ currentState: CONVERSATION_STATE.CART_REVIEW, context: { unmatchedTerms: [] } }])
  })
})
