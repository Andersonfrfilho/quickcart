/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O "reset" apaga o cliente inteiro. O que este arquivo guarda é o PORTÃO, não a limpeza.
 *
 * Com a flag desligada a palavra tem de ser texto comum — e o caso que importa é o do passo do
 * nome, onde todo texto vira o nome do cliente: é lá que um comando ligado por engano apagaria o
 * cadastro de quem só respondeu "Reset" à pergunta de como se chama.
 *
 * A pergunta do nome é NÓ DO GRAFO (`MainFlow.seed.ts`), não estado de sessão — por isso os casos
 * abaixo usam `greeting`, que é o estado em que o cliente sem nome está. O que os torna o caso do
 * nome é a ordem: o GlobalHandler responde antes do FlowDriver, e é essa precedência que se afirma.
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

const FULL_RESET = {
  deletedOrders: 2,
  deletedCarts: 1,
  deletedMessages: 40,
  deletedSessions: 1,
  deletedCustomers: 1,
}

const NOTHING_RESET = {
  deletedOrders: 0,
  deletedCarts: 0,
  deletedMessages: 0,
  deletedSessions: 0,
  deletedCustomers: 0,
}

function buildSession(currentState: string = CONVERSATION_STATE.CART_REVIEW): ConversationSession {
  return {
    id: 'session-1',
    customerPhone: PHONE,
    currentState,
    context: {},
    mode: 'bot',
    humanRequestedAt: null,
    lastInteractionAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function textMessage(body: string): ParsedInboundMessage {
  return { kind: 'text', from: PHONE, waMessageId: 'wa-1', body }
}

function buildDependencies(params: { isResetEnabled: boolean; result?: typeof FULL_RESET }) {
  const texts: string[] = []
  const resetCalls: string[] = []

  const dependencies = {
    conversationSessionRepository: { async updateStateByPhone() { return undefined } },
    whatsAppSender: {
      async sendText(_phone: string, text: string) {
        texts.push(text)
      },
    },
    customerResetRepository: {
      async resetByPhone(whatsAppNumber: string) {
        resetCalls.push(whatsAppNumber)
        return params.result ?? FULL_RESET
      },
    },
    isResetEnabled: params.isResetEnabled,
    orderRepository: { async findLastByCustomer() { return undefined } },
    cacheProvider: { async setIfNotExists() { return true } },
    cartRepository: { async findOpenByCustomer() { return undefined }, async updateStatus() { return undefined } },
    productRepository: {},
    repeatLastOrderUseCase: {},
    resolveCustomerDecisionUseCase: {},
    resolveItemSubstitutionUseCase: {},
    cancelOrderByCustomerUseCase: {},
    orderRealtimeNotifier: {},
    listHandler: {},
  } as unknown as GlobalHandlerDependencies

  return { dependencies, texts, resetCalls }
}

describe('GlobalHandler — reset', () => {
  it('apaga o cliente e relata o que saiu', async () => {
    const { dependencies, texts, resetCalls } = buildDependencies({ isResetEnabled: true })
    const handler = new GlobalHandler(dependencies)

    const handled = await handler.tryHandle({
      session: buildSession(),
      customer: CUSTOMER as Customer,
      message: textMessage('reset'),
    })

    expect(handled).toBe(true)
    expect(resetCalls).toEqual([PHONE])
    expect(texts).toHaveLength(1)
    expect(texts[0]).toContain('cadastro (1)')
    expect(texts[0]).toContain('pedidos (2)')
    expect(texts[0]).toContain('mensagens (40)')
  })

  /*
   * Relatar "apaguei pedidos (0)" ensina a desconfiar do relatório. O número que não apareceu é a
   * informação — e é a que diz, num teste, que o reset anterior já tinha levado tudo.
   */
  it('não lista o que não existia', async () => {
    const { dependencies, texts } = buildDependencies({ isResetEnabled: true, result: NOTHING_RESET })
    const handler = new GlobalHandler(dependencies)

    await handler.tryHandle({
      session: buildSession(),
      customer: CUSTOMER as Customer,
      message: textMessage('reset'),
    })

    expect(texts).toEqual([MESSAGES.RESET_DONE_NOTHING])
  })

  it('com a flag desligada a palavra não é comando e segue para o fluxo', async () => {
    const { dependencies, texts, resetCalls } = buildDependencies({ isResetEnabled: false })
    const handler = new GlobalHandler(dependencies)

    const handled = await handler.tryHandle({
      session: buildSession(),
      customer: CUSTOMER as Customer,
      message: textMessage('reset'),
    })

    expect(handled).toBe(false)
    expect(resetCalls).toEqual([])
    expect(texts).toEqual([])
  })

  /*
   * O caso que motivou o arquivo: em produção, com a flag desligada, quem se chama Reset precisa
   * conseguir se cadastrar. Se este teste quebrar, alguém apagou o portão.
   */
  it('com a flag desligada, "reset" no passo do nome segue sendo um nome', async () => {
    const { dependencies, resetCalls } = buildDependencies({ isResetEnabled: false })
    const handler = new GlobalHandler(dependencies)

    const handled = await handler.tryHandle({
      session: buildSession(CONVERSATION_STATE.GREETING),
      customer: CUSTOMER as Customer,
      message: textMessage('Reset'),
    })

    expect(handled).toBe(false)
    expect(resetCalls).toEqual([])
  })

  it('ligada, a palavra vence o passo do nome em vez de virar o nome', async () => {
    const { dependencies, resetCalls } = buildDependencies({ isResetEnabled: true })
    const handler = new GlobalHandler(dependencies)

    const handled = await handler.tryHandle({
      session: buildSession(CONVERSATION_STATE.GREETING),
      customer: CUSTOMER as Customer,
      message: textMessage('Reset'),
    })

    expect(handled).toBe(true)
    expect(resetCalls).toEqual([PHONE])
  })
})
