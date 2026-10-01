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

import { CartResumeHandler, type CartResumeHandlerDependencies } from '@/modules/conversation/application/handlers/CartResumeHandler'
import { GreetingHandler, type GreetingHandlerDependencies } from '@/modules/conversation/application/handlers/GreetingHandler'
import type { ConversationHandlerContext } from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { CART_RESUME_BUTTON_ID } from '@/modules/conversation/shared/Messages.constant'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'

const CUSTOMER_PHONE = '5511999990000'
const CUSTOMER_ID = 'customer-1'

type Harness = ReturnType<typeof buildHarness>

function buildHarness(options: { readonly itemCount: number }) {
  const states: string[] = []
  const sentTexts: string[] = []
  const sentButtonBodies: string[] = []
  const abandonedCartIds: string[] = []

  let openCart: { readonly id: string; readonly shortCode: string } | undefined = {
    id: 'cart-1',
    shortCode: 'LC-1000',
  }

  const conversationSessionRepository = {
    updateStateByPhone: async (params: { currentState: string }) => {
      states.push(params.currentState)
    },
  }

  const whatsAppSender = {
    sendText: async (_to: string, body: string) => {
      sentTexts.push(body)
    },
    sendInteractiveButtons: async (_to: string, body: string) => {
      sentButtonBodies.push(body)
    },
  }

  const cartRepository = {
    findOpenByCustomer: async () => openCart,
    listItems: async () => Array.from({ length: options.itemCount }, (_, index) => ({ id: `item-${index}` })),
  }

  const startNewCartUseCase = {
    execute: async () => {
      if (openCart) abandonedCartIds.push(openCart.id)
      openCart = { id: 'cart-2', shortCode: 'LC-1001' }
      return { cart: openCart }
    },
  }

  const dependencies = {
    conversationSessionRepository,
    whatsAppSender,
    cartRepository,
    productRepository: {
      findById: async (productId: string) => ({ id: productId, name: 'Arroz', priceInCents: 1_000 }),
    },
    startNewCartUseCase,
  }

  return {
    resumeHandler: new CartResumeHandler(dependencies as unknown as CartResumeHandlerDependencies),
    greetingHandler: new GreetingHandler(dependencies as unknown as GreetingHandlerDependencies),
    states,
    sentTexts,
    sentButtonBodies,
    abandonedCartIds,
  }
}

function buildContext(message: ParsedInboundMessage, context: ConversationContext = {}): ConversationHandlerContext {
  return {
    session: { customerPhone: CUSTOMER_PHONE, currentState: CONVERSATION_STATE.AWAITING_CART_RESUME_DECISION, context },
    customer: { id: CUSTOMER_ID },
    message,
  } as unknown as ConversationHandlerContext
}

function buildButtonReply(buttonId: string): ParsedInboundMessage {
  return { kind: 'button_reply', from: CUSTOMER_PHONE, waMessageId: 'wamid-1', buttonId, buttonTitle: buttonId }
}

function buildText(text: string): ParsedInboundMessage {
  return { kind: 'text', from: CUSTOMER_PHONE, waMessageId: 'wamid-1', body: text }
}

describe('GreetingHandler — volta com compra começada', () => {
  it('pergunta antes do menu quando a sessão expirou e o carrinho tem itens', async () => {
    const harness: Harness = buildHarness({ itemCount: 3 })

    await harness.greetingHandler.handle(buildContext(buildText('oi'), { wasExpired: true }))

    expect(harness.states).toEqual([CONVERSATION_STATE.AWAITING_CART_RESUME_DECISION])
    expect(harness.sentButtonBodies[0]).toContain('LC-1000')
    expect(harness.sentButtonBodies[0]).toContain('3 itens')
  })

  it('vai direto para o menu quando o carrinho da sessão anterior está vazio', async () => {
    const harness: Harness = buildHarness({ itemCount: 0 })

    await harness.greetingHandler.handle(buildContext(buildText('oi'), { wasExpired: true }))

    expect(harness.states).toEqual([CONVERSATION_STATE.MAIN_MENU])
  })

  it('não pergunta nada quando a sessão não expirou — o carrinho é o da conversa em andamento', async () => {
    const harness: Harness = buildHarness({ itemCount: 3 })

    await harness.greetingHandler.handle(buildContext(buildText('oi')))

    expect(harness.states).toEqual([CONVERSATION_STATE.MAIN_MENU])
  })
})

describe('CartResumeHandler', () => {
  it('continuar preserva o carrinho e o código, e devolve o resumo', async () => {
    const harness: Harness = buildHarness({ itemCount: 3 })

    await harness.resumeHandler.handle(buildContext(buildButtonReply(CART_RESUME_BUTTON_ID.CONTINUE)))

    expect(harness.abandonedCartIds).toEqual([])
    expect(harness.states).toEqual([CONVERSATION_STATE.CART_REVIEW])
    expect(harness.sentTexts[0]).toContain('LC-1000')
  })

  it('começar do zero abandona o carrinho anterior e anuncia o código novo', async () => {
    const harness: Harness = buildHarness({ itemCount: 3 })

    await harness.resumeHandler.handle(buildContext(buildButtonReply(CART_RESUME_BUTTON_ID.START_OVER)))

    expect(harness.abandonedCartIds).toEqual(['cart-1'])
    expect(harness.states).toEqual([CONVERSATION_STATE.MAIN_MENU])
    expect(harness.sentTexts[0]).toContain('LC-1001')
  })

  it('resposta que não é botão repete a pergunta sem sair do estado', async () => {
    const harness: Harness = buildHarness({ itemCount: 3 })

    await harness.resumeHandler.handle(buildContext(buildText('quero arroz')))

    expect(harness.states).toEqual([])
    expect(harness.sentButtonBodies[0]).toContain('LC-1000')
  })
})
