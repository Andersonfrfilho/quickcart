/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A saída — digitada ou por botão — e o que ela promete ao cliente.
 *
 * Arquivo separado porque a saída não tinha teste nenhum, e é exatamente por isso que passou
 * despercebido que ela zerava a sessão e deixava o carrinho de pé: quem saía por causa de um item
 * sem estoque voltava para o mesmo carrinho e para o mesmo erro.
 */

import { describe, expect, it } from 'bun:test'
import type { Customer } from '@/infra/database/schema'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { GLOBAL_BUTTON_ID, MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { ORDER_STATUS } from '@/modules/order/shared/Order.constant'
import { GlobalHandler, type GlobalHandlerDependencies } from './GlobalHandler'

const PHONE = '5511988887777'
const CUSTOMER: Pick<Customer, 'id'> = { id: 'customer-1' }
const SHORT_CODE = 'A1B2C3'

function buildSession(): ConversationSession {
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
  }
}

function textMessage(body: string): ParsedInboundMessage {
  return { kind: 'text', from: PHONE, waMessageId: 'wa-1', body }
}

function exitButtonMessage(): ParsedInboundMessage {
  return {
    kind: 'button_reply',
    from: PHONE,
    waMessageId: 'wa-1',
    buttonId: GLOBAL_BUTTON_ID.EXIT,
    buttonTitle: '👋 Sair',
  }
}

function buildDependencies(lastOrderStatus?: string) {
  const texts: string[] = []
  const stateUpdates: { currentState: string; context: Record<string, unknown> }[] = []

  const dependencies = {
    conversationSessionRepository: {
      async updateStateByPhone(params: { currentState: string; context: Record<string, unknown> }) {
        stateUpdates.push({ currentState: params.currentState, context: params.context })
        return undefined
      },
    },
    whatsAppSender: {
      async sendText(_phone: string, text: string) {
        texts.push(text)
      },
    },
    orderRepository: {
      async findLastByCustomer() {
        if (!lastOrderStatus) return undefined
        return { shortCode: SHORT_CODE, status: lastOrderStatus }
      },
    },
    cacheProvider: { async setIfNotExists() { return true } },
    cartRepository: {},
    productRepository: {},
    repeatLastOrderUseCase: {},
    resolveCustomerDecisionUseCase: {},
    resolveItemSubstitutionUseCase: {},
    cancelOrderByCustomerUseCase: {},
    orderRealtimeNotifier: {},
    listHandler: {},
  } as unknown as GlobalHandlerDependencies

  return { dependencies, texts, stateUpdates }
}

describe('GlobalHandler — saída', () => {
  it('solta o carrinho para a pergunta da volta em vez de zerar o contexto', async () => {
    const { dependencies, stateUpdates } = buildDependencies()
    const handler = new GlobalHandler(dependencies)

    const handled = await handler.tryHandle({
      session: buildSession(),
      customer: CUSTOMER as Customer,
      message: textMessage('sair'),
    })

    expect(handled).toBe(true)
    expect(stateUpdates).toEqual([
      { currentState: CONVERSATION_STATE.GREETING, context: { shouldAskCartResume: true } },
    ])
  })

  it('o botão de saída faz o mesmo que a palavra digitada', async () => {
    const { dependencies, texts, stateUpdates } = buildDependencies()
    const handler = new GlobalHandler(dependencies)

    const handled = await handler.tryHandle({
      session: buildSession(),
      customer: CUSTOMER as Customer,
      message: exitButtonMessage(),
    })

    expect(handled).toBe(true)
    expect(stateUpdates).toEqual([
      { currentState: CONVERSATION_STATE.GREETING, context: { shouldAskCartResume: true } },
    ])
    expect(texts).toEqual([MESSAGES.GOODBYE])
  })

  const statusesThatStillAcceptCancellation = [ORDER_STATUS.PENDING_CONFIRMATION, ORDER_STATUS.CONFIRMED]

  for (const status of statusesThatStillAcceptCancellation) {
    it(`diz qual é a palavra que cancela quando o pedido está em "${status}"`, async () => {
      const { dependencies, texts } = buildDependencies(status)
      const handler = new GlobalHandler(dependencies)

      await handler.tryHandle({
        session: buildSession(),
        customer: CUSTOMER as Customer,
        message: textMessage('sair'),
      })

      expect(texts).toHaveLength(1)
      expect(texts[0]).toContain(MESSAGES.GOODBYE)
      expect(texts[0]).toContain(SHORT_CODE)
      expect(texts[0]).toContain('cancelar pedido')
    })
  }

  const statusesAlreadyOnTheBench = [ORDER_STATUS.PREPARING, ORDER_STATUS.SEPARATED]

  for (const status of statusesAlreadyOnTheBench) {
    it(`não oferece cancelamento quando o pedido está em "${status}"`, async () => {
      const { dependencies, texts } = buildDependencies(status)
      const handler = new GlobalHandler(dependencies)

      await handler.tryHandle({
        session: buildSession(),
        customer: CUSTOMER as Customer,
        message: textMessage('sair'),
      })

      expect(texts).toEqual([MESSAGES.GOODBYE])
    })
  }

  it('sem pedido nenhum, a despedida é só a despedida', async () => {
    const { dependencies, texts } = buildDependencies()
    const handler = new GlobalHandler(dependencies)

    await handler.tryHandle({
      session: buildSession(),
      customer: CUSTOMER as Customer,
      message: textMessage('sair'),
    })

    expect(texts).toEqual([MESSAGES.GOODBYE])
  })
})
