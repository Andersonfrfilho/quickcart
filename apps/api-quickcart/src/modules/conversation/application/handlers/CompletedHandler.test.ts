/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O pós-compra: o que o bot responde entre a confirmação do pedido e a entrega.
 *
 * O caso que originou o arquivo está em `responde o "ok" sem reabrir o menu`: o cliente escolheu o
 * produto substituto de um item em falta, respondeu "ok", e o bot pediu que ele fizesse o pedido de
 * novo — porque a sessão voltava para `greeting` assim que a compra fechava.
 */

import { describe, expect, it } from 'bun:test'
import type { Customer } from '@/infra/database/schema'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { MESSAGES, ORDER_TRACKING_BUTTON_ID } from '@/modules/conversation/shared/Messages.constant'
import { DELIVERY_TYPE, ORDER_STATUS } from '@/modules/order/shared/Order.constant'
import { CompletedHandler, type CompletedHandlerDependencies } from './CompletedHandler'

const PHONE = '5511988887777'
const CUSTOMER = { id: 'customer-1' } as Customer
const SHORT_CODE = 'A1B2C3'

function buildSession(context: Record<string, unknown> = {}): ConversationSession {
  return {
    id: 'session-1',
    customerPhone: PHONE,
    currentState: CONVERSATION_STATE.COMPLETED,
    context,
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

function buttonMessage(buttonId: string): ParsedInboundMessage {
  return { kind: 'button_reply', from: PHONE, waMessageId: 'wa-1', buttonId, buttonTitle: 'botão' }
}

function buildDependencies(orderStatus?: string, deliveryType: string = DELIVERY_TYPE.DELIVERY) {
  const texts: string[] = []
  const interactive: { body: string; buttonIds: string[] }[] = []
  const stateUpdates: { currentState: string; context: Record<string, unknown> }[] = []
  let greetingCalls = 0

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
      async sendInteractiveButtons(_phone: string, body: string, buttons: readonly { id: string }[]) {
        interactive.push({ body, buttonIds: buttons.map((button) => button.id) })
      },
    },
    orderRepository: {
      async findLastByCustomer() {
        if (!orderStatus) return undefined
        return { shortCode: SHORT_CODE, status: orderStatus, deliveryType }
      },
    },
    greetingHandler: {
      async handle() {
        greetingCalls += 1
      },
    },
  } as unknown as CompletedHandlerDependencies

  return { dependencies, texts, interactive, stateUpdates, greeting: () => greetingCalls }
}

describe('CompletedHandler', () => {
  /*
   * O bug que originou o estado. O cliente responde "ok" à troca de um item e NÃO pode ouvir
   * "quer fazer um pedido?" — o pedido dele está em separação neste exato momento.
   */
  it('responde o "ok" sem reabrir o menu', async () => {
    const { dependencies, texts, interactive, greeting } = buildDependencies(ORDER_STATUS.PREPARING)
    const handler = new CompletedHandler(dependencies)

    await handler.handle({ session: buildSession(), customer: CUSTOMER, message: textMessage('ok') })

    expect(texts).toEqual([MESSAGES.ORDER_TRACKING_ACKNOWLEDGED.replace('{codigo}', SHORT_CODE)])
    expect(interactive).toEqual([])
    expect(greeting()).toBe(0)
  })

  it('responde a pergunta de status com o cartão e os três caminhos', async () => {
    const { dependencies, interactive, stateUpdates } = buildDependencies(ORDER_STATUS.OUT_FOR_DELIVERY)
    const handler = new CompletedHandler(dependencies)

    await handler.handle({ session: buildSession(), customer: CUSTOMER, message: textMessage('cadê meu pedido?') })

    expect(interactive).toHaveLength(1)
    expect(interactive[0]?.body).toContain(SHORT_CODE)
    expect(interactive[0]?.body).toContain(MESSAGES.ORDER_SITUATION_OUT_FOR_DELIVERY)
    expect(interactive[0]?.buttonIds).toContain(ORDER_TRACKING_BUTTON_ID.TRACK)
    expect(interactive[0]?.buttonIds).toContain(ORDER_TRACKING_BUTTON_ID.NEW_ORDER)
    // Guarda a situação mostrada para não repetir o cartão idêntico na próxima pergunta.
    expect(stateUpdates[0]?.context.trackedOrderStatus).toBe(ORDER_STATUS.OUT_FOR_DELIVERY)
    expect(stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.COMPLETED)
  })

  it('na segunda pergunta sobre a mesma situação manda só a linha', async () => {
    const { dependencies, texts, interactive } = buildDependencies(ORDER_STATUS.PREPARING)
    const handler = new CompletedHandler(dependencies)
    const session = buildSession({ trackedOrderStatus: ORDER_STATUS.PREPARING })

    await handler.handle({ session, customer: CUSTOMER, message: textMessage('e aí, quando chega?') })

    expect(interactive).toEqual([])
    expect(texts).toEqual([
      MESSAGES.ORDER_TRACKING_LINE.replace('{codigo}', SHORT_CODE).replace('{situacao}', MESSAGES.ORDER_SITUATION_PREPARING),
    ])
  })

  it('volta ao cartão quando a situação mudou de verdade', async () => {
    const { dependencies, interactive } = buildDependencies(ORDER_STATUS.IN_TRANSIT)
    const handler = new CompletedHandler(dependencies)
    const session = buildSession({ trackedOrderStatus: ORDER_STATUS.PREPARING })

    await handler.handle({ session, customer: CUSTOMER, message: textMessage('cadê?') })

    expect(interactive).toHaveLength(1)
    expect(interactive[0]?.body).toContain(MESSAGES.ORDER_SITUATION_IN_TRANSIT)
  })

  /* Texto que o bot não entende não vira chute: vira a situação do pedido e os botões. */
  it('oferece os botões quando não entende a mensagem', async () => {
    const { dependencies, interactive, texts } = buildDependencies(ORDER_STATUS.PREPARING)
    const handler = new CompletedHandler(dependencies)
    const session = buildSession({ trackedOrderStatus: ORDER_STATUS.PREPARING })

    await handler.handle({ session, customer: CUSTOMER, message: textMessage('e aquele negócio lá') })

    expect(texts).toEqual([])
    expect(interactive).toHaveLength(1)
    expect(interactive[0]?.buttonIds).toContain(ORDER_TRACKING_BUTTON_ID.NEW_ORDER)
  })

  it('"Novo pedido" entrega a conversa ao menu de sempre', async () => {
    const { dependencies, greeting } = buildDependencies(ORDER_STATUS.PREPARING)
    const handler = new CompletedHandler(dependencies)

    await handler.handle({
      session: buildSession(),
      customer: CUSTOMER,
      message: buttonMessage(ORDER_TRACKING_BUTTON_ID.NEW_ORDER),
    })

    expect(greeting()).toBe(1)
  })

  it('"Acompanhar" repete só a linha, sem a mesma tela de novo', async () => {
    const { dependencies, texts, interactive } = buildDependencies(ORDER_STATUS.READY_FOR_PICKUP)
    const handler = new CompletedHandler(dependencies)

    await handler.handle({
      session: buildSession(),
      customer: CUSTOMER,
      message: buttonMessage(ORDER_TRACKING_BUTTON_ID.TRACK),
    })

    expect(interactive).toEqual([])
    expect(texts[0]).toContain(MESSAGES.ORDER_SITUATION_READY_FOR_PICKUP)
  })

  /*
   * A saída do estado é por leitura, não por evento: sem isto a sessão ficaria presa no pós-compra
   * de um pedido entregue, e o cliente não conseguiria mais começar outra compra.
   */
  it('devolve a conversa à saudação quando o pedido terminou', async () => {
    const { dependencies, greeting, interactive } = buildDependencies(ORDER_STATUS.COMPLETED)
    const handler = new CompletedHandler(dependencies)

    await handler.handle({ session: buildSession(), customer: CUSTOMER, message: textMessage('oi') })

    expect(greeting()).toBe(1)
    expect(interactive).toEqual([])
  })

  it('devolve a conversa à saudação quando o pedido foi cancelado', async () => {
    const { dependencies, greeting } = buildDependencies(ORDER_STATUS.CANCELLED)
    const handler = new CompletedHandler(dependencies)

    await handler.handle({ session: buildSession(), customer: CUSTOMER, message: textMessage('oi') })

    expect(greeting()).toBe(1)
  })

  it('devolve a conversa à saudação quando não há pedido nenhum', async () => {
    const { dependencies, greeting } = buildDependencies()
    const handler = new CompletedHandler(dependencies)

    await handler.handle({ session: buildSession(), customer: CUSTOMER, message: textMessage('oi') })

    expect(greeting()).toBe(1)
  })

  /*
   * `awaiting_customer_decision` é o status que mais precisava de tradução: "aguardando decisão do
   * cliente" é uma pergunta sem a pergunta, e quem lê isso não sabe o que foi perguntado.
   */
  it('explica que a separação está parada esperando a resposta do cliente', async () => {
    const { dependencies, interactive } = buildDependencies(ORDER_STATUS.AWAITING_CUSTOMER_DECISION)
    const handler = new CompletedHandler(dependencies)

    await handler.handle({ session: buildSession(), customer: CUSTOMER, message: textMessage('cadê?') })

    expect(interactive[0]?.body).toContain(MESSAGES.ORDER_SITUATION_AWAITING_CUSTOMER_DECISION)
    expect(interactive[0]?.body).not.toContain('awaiting')
  })

  /*
   * A sacola separada de uma RETIRADA não está "saindo em instantes": ela está no balcão esperando o
   * cliente. Dizer o contrário manda ele ficar em casa aguardando um entregador que nunca vai sair —
   * e foi exatamente o que o preview mostrou antes desta distinção existir.
   */
  it('na retirada, separado quer dizer pronto para retirar', async () => {
    const { dependencies, interactive } = buildDependencies(ORDER_STATUS.SEPARATED, DELIVERY_TYPE.PICKUP)
    const handler = new CompletedHandler(dependencies)

    await handler.handle({ session: buildSession(), customer: CUSTOMER, message: textMessage('cadê?') })

    expect(interactive[0]?.body).toContain(MESSAGES.ORDER_SITUATION_READY_FOR_PICKUP)
    expect(interactive[0]?.body).not.toContain(MESSAGES.ORDER_SITUATION_SEPARATED)
  })

  it('na entrega, separado continua sendo "saindo em instantes"', async () => {
    const { dependencies, interactive } = buildDependencies(ORDER_STATUS.SEPARATED, DELIVERY_TYPE.DELIVERY)
    const handler = new CompletedHandler(dependencies)

    await handler.handle({ session: buildSession(), customer: CUSTOMER, message: textMessage('cadê?') })

    expect(interactive[0]?.body).toContain(MESSAGES.ORDER_SITUATION_SEPARATED)
  })
})
