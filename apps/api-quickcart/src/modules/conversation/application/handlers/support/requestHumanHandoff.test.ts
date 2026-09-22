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
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { requestHumanHandoff, type RequestHumanHandoffDependencies } from './requestHumanHandoff'

const PHONE = '5511988887777'

function buildSession(overrides: Partial<ConversationSession> = {}): ConversationSession {
  return {
    id: 'session-1',
    customerPhone: PHONE,
    currentState: CONVERSATION_STATE.CART_REVIEW,
    context: {},
    mode: 'bot',
    humanRequestedAt: null,
    lastInteractionAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function buildDependencies(session: ConversationSession | undefined) {
  const texts: string[] = []
  const requestHumanCalls: string[] = []

  const dependencies: RequestHumanHandoffDependencies = {
    conversationSessionRepository: {
      async findByPhone() {
        return session
      },
      async requestHuman(customerPhone: string) {
        requestHumanCalls.push(customerPhone)
      },
    },
    whatsAppSender: {
      async sendText(_phone: string, text: string) {
        texts.push(text)
      },
    },
  }

  return { dependencies, texts, requestHumanCalls }
}

describe('requestHumanHandoff', () => {
  it('marca a fila de espera e avisa o cliente quando ninguém tinha pedido ainda', async () => {
    const { dependencies, texts, requestHumanCalls } = buildDependencies(buildSession({ humanRequestedAt: null }))

    await requestHumanHandoff(dependencies, PHONE)

    expect(requestHumanCalls).toEqual([PHONE])
    expect(texts).toEqual([MESSAGES.AGENT_REQUESTED])
  })

  it('chama requestHuman de novo mesmo com pedido anterior já resolvido (mode bot)', async () => {
    // Este é o caso que a T3.1 quebrou: `humanRequestedAt` antigo (pedido já atendido e devolvido
    // ao bot) não pode bloquear um pedido novo — o pacote nunca limpa esse campo, só `mode`.
    const { dependencies, texts, requestHumanCalls } = buildDependencies(
      buildSession({ mode: 'bot', humanRequestedAt: new Date('2020-01-01') }),
    )

    await requestHumanHandoff(dependencies, PHONE)

    expect(requestHumanCalls).toEqual([PHONE])
    expect(texts).toEqual([MESSAGES.AGENT_REQUESTED])
  })

  it('não chama requestHuman quando já está em atendimento humano (mode human)', async () => {
    const { dependencies, texts, requestHumanCalls } = buildDependencies(
      buildSession({ mode: 'human', humanRequestedAt: new Date() }),
    )

    await requestHumanHandoff(dependencies, PHONE)

    expect(requestHumanCalls).toEqual([])
    expect(texts).toEqual([MESSAGES.AGENT_HUMAN_IN_PROGRESS])
  })
})
