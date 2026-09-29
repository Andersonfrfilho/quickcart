/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A volta: quem chega em `greeting` com carrinho aberto responde uma pergunta antes de ver o menu.
 *
 * Duas portas levam à mesma pergunta e só uma delas se desculpa: expirar é acidente do sistema,
 * sair é decisão do cliente — e pedir desculpa por uma escolha dele confunde.
 */

import { describe, expect, it } from 'bun:test'
import type { Customer } from '@/infra/database/schema'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { CART_RESUME_BUTTONS, MENU_BUTTONS, MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { GreetingHandler, type GreetingHandlerDependencies } from './GreetingHandler'

const PHONE = '5511988887777'
const CUSTOMER: Pick<Customer, 'id'> = { id: 'customer-1' }

function buildSession(context: Record<string, unknown>): ConversationSession {
  return {
    id: 'session-1',
    customerPhone: PHONE,
    currentState: CONVERSATION_STATE.GREETING,
    context,
    mode: 'bot',
    humanRequestedAt: null,
    lastInteractionAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function buildDependencies(itemCount: number) {
  const buttonMessages: { body: string; buttons: readonly { id: string; title: string }[] }[] = []
  const stateUpdates: string[] = []

  const dependencies = {
    conversationSessionRepository: {
      async updateStateByPhone(params: { currentState: string }) {
        stateUpdates.push(params.currentState)
        return undefined
      },
    },
    whatsAppSender: {
      async sendInteractiveButtons(_phone: string, body: string, buttons: readonly { id: string; title: string }[]) {
        buttonMessages.push({ body, buttons })
      },
    },
    cartRepository: {
      async findOpenByCustomer() {
        return { id: 'cart-1', shortCode: 'C1D2E3' }
      },
      async listItems() {
        return Array.from({ length: itemCount }, (_, index) => ({ id: `item-${index}` }))
      },
    },
  } as unknown as GreetingHandlerDependencies

  return { dependencies, buttonMessages, stateUpdates }
}

describe('GreetingHandler — volta com carrinho aberto', () => {
  it('quem saiu por vontade própria escolhe o destino do carrinho, sem aviso de expiração', async () => {
    const { dependencies, buttonMessages, stateUpdates } = buildDependencies(2)
    const handler = new GreetingHandler(dependencies)

    await handler.handle({
      session: buildSession({ shouldAskCartResume: true }),
      customer: CUSTOMER as Customer,
      message: { kind: 'text', from: PHONE, waMessageId: 'wa-1', body: 'oi' },
    })

    expect(stateUpdates).toEqual([CONVERSATION_STATE.AWAITING_CART_RESUME_DECISION])
    expect(buttonMessages).toHaveLength(1)
    expect(buttonMessages[0]?.buttons).toBe(CART_RESUME_BUTTONS)
    expect(buttonMessages[0]?.body).toContain('C1D2E3')
    expect(buttonMessages[0]?.body).not.toContain(MESSAGES.SESSION_EXPIRED_PREFIX)
  })

  it('carrinho vazio não vira pergunta: vai direto ao menu', async () => {
    const { dependencies, buttonMessages, stateUpdates } = buildDependencies(0)
    const handler = new GreetingHandler(dependencies)

    await handler.handle({
      session: buildSession({ shouldAskCartResume: true }),
      customer: CUSTOMER as Customer,
      message: { kind: 'text', from: PHONE, waMessageId: 'wa-1', body: 'oi' },
    })

    expect(stateUpdates).toEqual([CONVERSATION_STATE.MAIN_MENU])
    expect(buttonMessages[0]?.buttons).toBe(MENU_BUTTONS)
    expect(buttonMessages[0]?.body).toBe(MESSAGES.WELCOME)
  })

  it('sessão expirada continua se desculpando quando não há carrinho a retomar', async () => {
    const { dependencies, buttonMessages } = buildDependencies(0)
    const handler = new GreetingHandler(dependencies)

    await handler.handle({
      session: buildSession({ wasExpired: true }),
      customer: CUSTOMER as Customer,
      message: { kind: 'text', from: PHONE, waMessageId: 'wa-1', body: 'oi' },
    })

    expect(buttonMessages[0]?.body).toBe(`${MESSAGES.SESSION_EXPIRED_PREFIX}${MESSAGES.WELCOME}`)
  })
})
