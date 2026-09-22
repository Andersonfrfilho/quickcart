/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cobre só o pedido de atendente por palavra-chave (T3.1). O resto do `GlobalHandler`
 * ("sair", decisão de pedido, repetir compra, lista solta) já tem comportamento estável e não
 * muda aqui.
 */

import { describe, expect, it } from 'bun:test'
import type { Customer } from '@/infra/database/schema'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { GlobalHandler, type GlobalHandlerDependencies } from './GlobalHandler'

const PHONE = '5511988887777'
const CUSTOMER: Pick<Customer, 'id'> = { id: 'customer-1' }

function buildSession(overrides: Partial<ConversationSession> = {}): ConversationSession {
  return {
    id: 'session-1',
    customerPhone: PHONE,
    currentState: CONVERSATION_STATE.AWAITING_LIST,
    context: {},
    mode: 'bot',
    humanRequestedAt: null,
    lastInteractionAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function textMessage(body: string): ParsedInboundMessage {
  return { kind: 'text', from: PHONE, waMessageId: 'wa-1', body }
}

function buildDependencies(session: ConversationSession) {
  const texts: string[] = []
  const requestHumanCalls: string[] = []
  const listHandlerCalls: number[] = []

  const dependencies = {
    conversationSessionRepository: {
      async findByPhone() {
        return session
      },
      async requestHuman(customerPhone: string) {
        requestHumanCalls.push(customerPhone)
      },
      async updateStateByPhone() {
        return session
      },
    },
    whatsAppSender: {
      async sendText(_phone: string, text: string) {
        texts.push(text)
      },
    },
    cartRepository: {},
    productRepository: {},
    repeatLastOrderUseCase: {},
    resolveCustomerDecisionUseCase: {},
    resolveItemSubstitutionUseCase: {},
    listHandler: {
      async handle() {
        listHandlerCalls.push(1)
      },
    },
  } as unknown as GlobalHandlerDependencies

  return { dependencies, texts, requestHumanCalls, listHandlerCalls }
}

describe('GlobalHandler — pedido de atendente por palavra-chave (T3.1)', () => {
  const statesWhereItShouldTrigger = [
    CONVERSATION_STATE.AWAITING_LIST,
    CONVERSATION_STATE.CART_REVIEW,
    CONVERSATION_STATE.AWAITING_PAYMENT,
    CONVERSATION_STATE.CONFIRMING,
  ]

  for (const currentState of statesWhereItShouldTrigger) {
    it(`dispara a mesma ação do botão do menu em "${currentState}"`, async () => {
      const session = buildSession({ currentState })
      const { dependencies, texts, requestHumanCalls } = buildDependencies(session)
      const handler = new GlobalHandler(dependencies)

      const handled = await handler.tryHandle({
        session,
        customer: CUSTOMER as Customer,
        message: textMessage('Quero falar com um atendente!'),
      })

      expect(handled).toBe(true)
      expect(requestHumanCalls).toEqual([PHONE])
      expect(texts).toEqual([MESSAGES.AGENT_REQUESTED])
    })
  }

  it('não chama requestHuman de novo quando um atendente já assumiu (mode human)', async () => {
    const session = buildSession({ mode: 'human', humanRequestedAt: new Date() })
    const { dependencies, texts, requestHumanCalls } = buildDependencies(session)
    const handler = new GlobalHandler(dependencies)

    const handled = await handler.tryHandle({
      session,
      customer: CUSTOMER as Customer,
      message: textMessage('atendente'),
    })

    expect(handled).toBe(true)
    expect(requestHumanCalls).toEqual([])
    expect(texts).toEqual([MESSAGES.AGENT_HUMAN_IN_PROGRESS])
  })

  it('chama requestHuman de novo com mode bot mesmo com pedido anterior já resolvido', async () => {
    // Antes da correção, `humanRequestedAt` antigo (pedido já atendido e devolvido ao bot) fazia
    // esta chamada ser tratada como duplicata para sempre — o pacote nunca limpa esse campo.
    const session = buildSession({ mode: 'bot', humanRequestedAt: new Date('2020-01-01') })
    const { dependencies, texts, requestHumanCalls } = buildDependencies(session)
    const handler = new GlobalHandler(dependencies)

    const handled = await handler.tryHandle({
      session,
      customer: CUSTOMER as Customer,
      message: textMessage('atendente'),
    })

    expect(handled).toBe(true)
    expect(requestHumanCalls).toEqual([PHONE])
    expect(texts).toEqual([MESSAGES.AGENT_REQUESTED])
  })

  it('checa o pedido de atendente ANTES do parser de lista de compras', async () => {
    // "atendente" sozinho, em awaiting_list, poderia virar tentativa de casar produto — a ordem
    // no GlobalHandler garante que a palavra-chave vence antes de chegar no handler do estado.
    const session = buildSession({ currentState: CONVERSATION_STATE.AWAITING_LIST })
    const { dependencies, requestHumanCalls, listHandlerCalls } = buildDependencies(session)
    const handler = new GlobalHandler(dependencies)

    await handler.tryHandle({
      session,
      customer: CUSTOMER as Customer,
      message: textMessage('atendente'),
    })

    expect(requestHumanCalls).toEqual([PHONE])
    expect(listHandlerCalls).toEqual([])
  })

  it('não engole mensagem que não é pedido de atendente — segue para o handler do estado', async () => {
    const session = buildSession({ currentState: CONVERSATION_STATE.CART_REVIEW })
    const { dependencies, texts, requestHumanCalls } = buildDependencies(session)
    const handler = new GlobalHandler(dependencies)

    const handled = await handler.tryHandle({
      session,
      customer: CUSTOMER as Customer,
      message: textMessage('o atendente de ontem errou meu pedido'),
    })

    expect(handled).toBe(false)
    expect(requestHumanCalls).toEqual([])
    expect(texts).toEqual([])
  })
})
