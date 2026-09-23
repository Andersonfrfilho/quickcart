/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * "Quero mudar" pergunta O QUE mudar, e cada troca volta ao resumo — antes o botão apagava a memória
 * inteira e jogava o cliente na primeira pergunta do fechamento. Cobre também o e-mail já cadastrado,
 * que era pedido de novo em toda compra.
 */

import { describe, expect, it } from 'bun:test'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'
import type { ConversationHandlerContext } from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import {
  CHECKOUT_CHANGE_ROW_ID,
  DELIVERY_TYPE_BUTTON_ID,
  EMAIL_CONFIRMATION_BUTTON_ID,
  MESSAGES,
  PAYMENT_METHOD_BUTTON_ID,
  RECEIPT_PREFERENCE_BUTTON_ID,
  REMEMBERED_CHECKOUT_BUTTON_ID,
} from '@/modules/conversation/shared/Messages.constant'
import { CheckoutHandler, type CheckoutHandlerDependencies } from './CheckoutHandler'

const PHONE = '5511988887777'
const CUSTOMER_ID = 'customer-1'
const SAVED_EMAIL = 'anderson@example.com'

const REMEMBERED_ADDRESS = {
  cep: '01001000',
  street: 'Praça da Sé',
  number: '10',
  neighborhood: 'Sé',
  city: 'São Paulo',
  state: 'SP',
}

const REMEMBERED = {
  deliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY,
  address: REMEMBERED_ADDRESS,
  paymentMethod: PAYMENT_METHOD_BUTTON_ID.CASH,
  receiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.BOTH,
  email: SAVED_EMAIL,
}

function buildHarness() {
  const texts: string[] = []
  const buttonMessages: { body: string; buttons: readonly { id: string; title: string }[] }[] = []
  const lists: { body: string; rowIds: readonly string[] }[] = []
  const stateUpdates: { currentState: string; context: Record<string, unknown> }[] = []
  const savedEmails: string[] = []

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
      async sendInteractiveButtons(_phone: string, body: string, buttons: readonly { id: string; title: string }[]) {
        buttonMessages.push({ body, buttons })
      },
      async sendInteractiveList(
        _phone: string,
        body: string,
        _buttonText: string,
        sections: readonly { rows: readonly { id: string }[] }[],
      ) {
        lists.push({ body, rowIds: sections.flatMap((section) => section.rows.map((row) => row.id)) })
      },
    },
    customerRepository: {
      async updateContactInfo(params: { email: string }) {
        savedEmails.push(params.email)
      },
    },
    cartRepository: {},
    productRepository: {},
    createOrderFromCartUseCase: {},
    addressLookupProvider: {},
    quoteDeliveryFeeUseCase: {},
  } as unknown as CheckoutHandlerDependencies

  return { handler: new CheckoutHandler(dependencies), texts, buttonMessages, lists, stateUpdates, savedEmails }
}

function buildContext(params: {
  readonly currentState: string
  readonly context: Record<string, unknown>
  readonly message: ParsedInboundMessage
  readonly customerEmail?: string
}): ConversationHandlerContext {
  const session: ConversationSession = {
    id: 'session-1',
    customerPhone: PHONE,
    currentState: params.currentState,
    context: params.context,
    mode: 'bot',
    lastInteractionAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as ConversationSession

  return {
    session,
    customer: { id: CUSTOMER_ID, ...(params.customerEmail ? { email: params.customerEmail } : {}) },
    message: params.message,
  } as unknown as ConversationHandlerContext
}

function buttonReply(buttonId: string): ParsedInboundMessage {
  return { kind: 'button_reply', from: PHONE, waMessageId: 'w', buttonId, buttonTitle: buttonId }
}

function listReply(listId: string): ParsedInboundMessage {
  return { kind: 'list_reply', from: PHONE, waMessageId: 'w', listId, listTitle: listId }
}

describe('CheckoutHandler — "quero mudar"', () => {
  it('abre a lista do que mudar em vez de recomeçar o fechamento', async () => {
    const harness = buildHarness()

    await harness.handler.handle(
      buildContext({
        currentState: CONVERSATION_STATE.AWAITING_DELIVERY_TYPE,
        context: { rememberedCheckout: REMEMBERED },
        message: buttonReply(REMEMBERED_CHECKOUT_BUTTON_ID.CHANGE_PREFERENCES),
      }),
    )

    expect(harness.stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.AWAITING_CHECKOUT_CHANGE_CHOICE)
    expect(harness.lists[0]?.rowIds).toEqual([
      CHECKOUT_CHANGE_ROW_ID.DELIVERY_TYPE,
      CHECKOUT_CHANGE_ROW_ID.ADDRESS,
      CHECKOUT_CHANGE_ROW_ID.PAYMENT,
      CHECKOUT_CHANGE_ROW_ID.RECEIPT,
      CHECKOUT_CHANGE_ROW_ID.NONE,
    ])
    // A memória continua de pé: mudar uma coisa não pode custar as outras três.
    expect(harness.stateUpdates[0]?.context.rememberedCheckout).toEqual(REMEMBERED)
  })

  it('não oferece trocar endereço para quem vai retirar na loja', async () => {
    const harness = buildHarness()

    await harness.handler.handle(
      buildContext({
        currentState: CONVERSATION_STATE.AWAITING_DELIVERY_TYPE,
        context: {
          rememberedCheckout: { ...REMEMBERED, deliveryType: DELIVERY_TYPE_BUTTON_ID.PICKUP, address: undefined },
        },
        message: buttonReply(REMEMBERED_CHECKOUT_BUTTON_ID.CHANGE_PREFERENCES),
      }),
    )

    expect(harness.lists[0]?.rowIds).not.toContain(CHECKOUT_CHANGE_ROW_ID.ADDRESS)
  })

  it('trocar o pagamento volta ao resumo com o valor novo, sem refazer o resto', async () => {
    const harness = buildHarness()

    await harness.handler.handle(
      buildContext({
        currentState: CONVERSATION_STATE.AWAITING_CHECKOUT_CHANGE_CHOICE,
        context: { rememberedCheckout: REMEMBERED },
        message: listReply(CHECKOUT_CHANGE_ROW_ID.PAYMENT),
      }),
    )
    expect(harness.stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.AWAITING_CHECKOUT_CHANGE_PAYMENT)

    await harness.handler.handle(
      buildContext({
        currentState: CONVERSATION_STATE.AWAITING_CHECKOUT_CHANGE_PAYMENT,
        context: { rememberedCheckout: REMEMBERED },
        message: buttonReply(PAYMENT_METHOD_BUTTON_ID.PIX),
      }),
    )

    const back = harness.stateUpdates[1]
    expect(back?.currentState).toBe(CONVERSATION_STATE.AWAITING_DELIVERY_TYPE)
    expect((back?.context.rememberedCheckout as { paymentMethod: string }).paymentMethod).toBe(
      PAYMENT_METHOD_BUTTON_ID.PIX,
    )
    // Endereço e recibo continuam os mesmos — só o pagamento mudou.
    expect((back?.context.rememberedCheckout as { address: unknown }).address).toEqual(REMEMBERED_ADDRESS)
    expect((back?.context.rememberedCheckout as { receiptPreference: string }).receiptPreference).toBe(
      RECEIPT_PREFERENCE_BUTTON_ID.BOTH,
    )
    expect(harness.buttonMessages.at(-1)?.buttons.map((button) => button.id)).toEqual([
      REMEMBERED_CHECKOUT_BUTTON_ID.SAME_AS_LAST,
      REMEMBERED_CHECKOUT_BUTTON_ID.CHANGE_PREFERENCES,
    ])
  })

  it('"deixa como está" devolve o resumo intacto', async () => {
    const harness = buildHarness()

    await harness.handler.handle(
      buildContext({
        currentState: CONVERSATION_STATE.AWAITING_CHECKOUT_CHANGE_CHOICE,
        context: { rememberedCheckout: REMEMBERED },
        message: listReply(CHECKOUT_CHANGE_ROW_ID.NONE),
      }),
    )

    expect(harness.stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.AWAITING_DELIVERY_TYPE)
    expect(harness.stateUpdates[0]?.context.rememberedCheckout).toEqual(REMEMBERED)
  })

  it('trocar o recibo reaproveita o e-mail guardado em vez de pedir de novo', async () => {
    const harness = buildHarness()

    await harness.handler.handle(
      buildContext({
        currentState: CONVERSATION_STATE.AWAITING_CHECKOUT_CHANGE_RECEIPT,
        context: { rememberedCheckout: { ...REMEMBERED, receiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP } },
        message: buttonReply(RECEIPT_PREFERENCE_BUTTON_ID.EMAIL),
        customerEmail: SAVED_EMAIL,
      }),
    )

    expect(harness.stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.AWAITING_DELIVERY_TYPE)
    expect(harness.texts).not.toContain(MESSAGES.CHECKOUT_ASK_EMAIL)
  })
})

describe('CheckoutHandler — e-mail já cadastrado', () => {
  it('oferece o e-mail salvo em vez de pedir para digitar de novo', async () => {
    const harness = buildHarness()

    await harness.handler.handle(
      buildContext({
        currentState: CONVERSATION_STATE.AWAITING_RECEIPT_PREFERENCE,
        context: { checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY },
        message: buttonReply(RECEIPT_PREFERENCE_BUTTON_ID.BOTH),
        customerEmail: SAVED_EMAIL,
      }),
    )

    expect(harness.stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.AWAITING_EMAIL_CONFIRMATION)
    expect(harness.buttonMessages.at(-1)?.body).toContain(SAVED_EMAIL)
    expect(harness.texts).not.toContain(MESSAGES.CHECKOUT_ASK_EMAIL)
  })

  it('sem e-mail no cadastro, continua perguntando como antes', async () => {
    const harness = buildHarness()

    await harness.handler.handle(
      buildContext({
        currentState: CONVERSATION_STATE.AWAITING_RECEIPT_PREFERENCE,
        context: { checkoutDeliveryType: DELIVERY_TYPE_BUTTON_ID.DELIVERY },
        message: buttonReply(RECEIPT_PREFERENCE_BUTTON_ID.BOTH),
      }),
    )

    expect(harness.stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.AWAITING_EMAIL)
    expect(harness.texts).toContain(MESSAGES.CHECKOUT_ASK_EMAIL)
  })

  it('"outro e-mail" volta a pedir o endereço digitado', async () => {
    const harness = buildHarness()

    await harness.handler.handle(
      buildContext({
        currentState: CONVERSATION_STATE.AWAITING_EMAIL_CONFIRMATION,
        context: { checkoutReceiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.BOTH },
        message: buttonReply(EMAIL_CONFIRMATION_BUTTON_ID.USE_ANOTHER),
        customerEmail: SAVED_EMAIL,
      }),
    )

    expect(harness.stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.AWAITING_EMAIL)
    expect(harness.texts).toContain(MESSAGES.CHECKOUT_ASK_EMAIL)
  })
})
