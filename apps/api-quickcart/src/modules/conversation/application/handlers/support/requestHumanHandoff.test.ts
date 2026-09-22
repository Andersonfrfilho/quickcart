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
import {
  HUMAN_HANDOFF_COOLDOWN_KEY_PREFIX,
  HUMAN_HANDOFF_COOLDOWN_SECONDS,
} from '@/modules/conversation/shared/HumanHandoff.constant'

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

type CooldownStub = RequestHumanHandoffDependencies['cacheProvider']

/** `SET NX` em memória: a primeira chamada por chave ganha, as seguintes perdem. */
function buildInMemoryCooldown(): CooldownStub & { readonly keys: string[] } {
  const keys: string[] = []
  return {
    keys,
    async setIfNotExists(key: string) {
      if (keys.includes(key)) return false
      keys.push(key)
      return true
    },
    async del(key: string) {
      const index = keys.indexOf(key)
      if (index >= 0) keys.splice(index, 1)
    },
  }
}

function buildDependencies(session: ConversationSession | undefined, cacheProvider: CooldownStub = buildInMemoryCooldown()) {
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
    cacheProvider,
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

  it('segundo pedido em modo bot dentro do cooldown só avisa, sem chamar requestHuman', async () => {
    const { dependencies, texts, requestHumanCalls } = buildDependencies(buildSession({ mode: 'bot' }))

    await requestHumanHandoff(dependencies, PHONE)
    await requestHumanHandoff(dependencies, PHONE)

    expect(requestHumanCalls).toEqual([PHONE])
    expect(texts).toEqual([MESSAGES.AGENT_REQUESTED, MESSAGES.AGENT_ALREADY_NOTIFIED])
  })

  it('cooldown é por telefone e a chave não leva o número em claro', async () => {
    const cooldown = buildInMemoryCooldown()
    const { dependencies, requestHumanCalls } = buildDependencies(buildSession({ mode: 'bot' }), cooldown)

    await requestHumanHandoff(dependencies, PHONE)
    await requestHumanHandoff(dependencies, '5511977776666')

    expect(requestHumanCalls).toEqual([PHONE, '5511977776666'])
    expect(cooldown.keys[0]?.startsWith(`${HUMAN_HANDOFF_COOLDOWN_KEY_PREFIX}:`)).toBe(true)
    expect(cooldown.keys.join()).not.toContain(PHONE)
  })

  it('arma o cooldown com TTL de 10 minutos', async () => {
    const ttls: number[] = []
    const { dependencies } = buildDependencies(buildSession({ mode: 'bot' }), {
      async setIfNotExists(_key: string, _value: string, ttlSeconds: number) {
        ttls.push(ttlSeconds)
        return true
      },
      async del() {},
    })

    await requestHumanHandoff(dependencies, PHONE)

    expect(ttls).toEqual([HUMAN_HANDOFF_COOLDOWN_SECONDS])
  })

  it('Redis fora do ar: fail-open, o pedido segue como antes', async () => {
    const { dependencies, texts, requestHumanCalls } = buildDependencies(buildSession({ mode: 'bot' }), {
      async setIfNotExists() {
        throw new Error('redis down')
      },
      async del() {
        throw new Error('redis down')
      },
    })

    await requestHumanHandoff(dependencies, PHONE)
    await requestHumanHandoff(dependencies, PHONE)

    expect(requestHumanCalls).toEqual([PHONE, PHONE])
    expect(texts).toEqual([MESSAGES.AGENT_REQUESTED, MESSAGES.AGENT_REQUESTED])
  })

  it('mode human não consome o cooldown: o aviso de atendimento em curso não muda', async () => {
    const cooldown = buildInMemoryCooldown()
    const { dependencies, texts } = buildDependencies(buildSession({ mode: 'human' }), cooldown)

    await requestHumanHandoff(dependencies, PHONE)

    expect(cooldown.keys).toEqual([])
    expect(texts).toEqual([MESSAGES.AGENT_HUMAN_IN_PROGRESS])
  })
})

describe('requestHumanHandoff — falha ao registrar o pedido', () => {
  it('libera o intervalo: a próxima tentativa chama a equipe, e não ouve "já avisei"', async () => {
    const cooldown = buildInMemoryCooldown()
    let failNext = true
    const texts: string[] = []
    const requestHumanCalls: string[] = []
    const dependencies: RequestHumanHandoffDependencies = {
      conversationSessionRepository: {
        async findByPhone() {
          return buildSession({ mode: 'bot' })
        },
        async requestHuman(customerPhone: string) {
          if (failNext) {
            failNext = false
            throw new Error('banco fora do ar')
          }
          requestHumanCalls.push(customerPhone)
        },
      },
      whatsAppSender: {
        async sendText(_phone: string, text: string) {
          texts.push(text)
        },
      },
      cacheProvider: cooldown,
    }

    // A falha propaga — quem chamou precisa saber que o pedido não foi registrado.
    await expect(requestHumanHandoff(dependencies, PHONE)).rejects.toThrow('banco fora do ar')

    expect(cooldown.keys).toEqual([])

    await requestHumanHandoff(dependencies, PHONE)

    expect(requestHumanCalls).toEqual([PHONE])
    expect(texts).toEqual([MESSAGES.AGENT_REQUESTED])
  })
})
