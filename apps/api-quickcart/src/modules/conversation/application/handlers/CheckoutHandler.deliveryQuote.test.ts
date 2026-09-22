/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cotação por faixa no checkout do WhatsApp (T3.1, spec §3.4): a taxa sai quando o endereço fica
 * pronto — por CEP ou pela localização do WhatsApp —, fora do raio vira escolha entre retirar e
 * outro endereço, e "Isso mesmo" recota a entrega lembrada. Coordenada nunca em log.
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'

import type { Customer } from '@/infra/database/schema'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'
import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'
import {
  ADDRESS_DECISION_BUTTON_ID,
  ADDRESS_PICKUP_INSTEAD_BUTTONS,
  APPROXIMATE_ADDRESS_BUTTON_ID,
  APPROXIMATE_ADDRESS_DECISION_BUTTONS,
  APPROXIMATE_ESTIMATE_BUTTONS,
  CONFIRMING_BUTTON_ID,
  DELIVERY_TYPE_BUTTON_ID,
  DELIVERY_TYPE_BUTTONS,
  MESSAGES,
  OUT_OF_RANGE_DECISION_BUTTONS,
  PAYMENT_METHOD_BUTTON_ID,
  PAYMENT_METHOD_BUTTONS,
  RECEIPT_PREFERENCE_BUTTON_ID,
  REMEMBERED_CHECKOUT_BUTTON_ID,
} from '@/modules/conversation/shared/Messages.constant'
import type { QuoteDeliveryFeeParams, QuoteDeliveryFeeResult } from '@/modules/order/application/types/QuoteDeliveryFee.types'
import {
  CUSTOMER_LOCATION_KIND,
  DELIVERY_LOCATION_SOURCE,
  DELIVERY_QUOTE_KIND,
  DELIVERY_UNAVAILABLE_REASON,
} from '@/modules/order/shared/DeliveryFeeQuote.constant'
import { DELIVERY_TYPE, RECEIPT_PREFERENCE } from '@/modules/order/shared/Order.constant'
import { Logger } from '@/shared/logger'
import { CheckoutHandler, type CheckoutHandlerDependencies } from './CheckoutHandler'

const PHONE = '5511988887777'
const CEP = '01310100'
const LATITUDE = -23.5613
const LONGITUDE = -46.6565

const CUSTOMER: Customer = {
  id: 'customer-1',
  phone: PHONE,
  name: null,
  email: null,
  userId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const VIACEP_ADDRESS = { street: 'Avenida Paulista', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP' }

const QUOTED: QuoteDeliveryFeeResult = {
  kind: DELIVERY_QUOTE_KIND.QUOTED,
  feeInCents: 500,
  distanceKm: 2.43,
  tier: { maxDistanceKm: 3, feeInCents: 500 },
  source: DELIVERY_LOCATION_SOURCE.CEP,
}
const QUOTED_BY_LOCATION: QuoteDeliveryFeeResult = { ...QUOTED, source: DELIVERY_LOCATION_SOURCE.WHATSAPP_LOCATION }
const APPROXIMATE: QuoteDeliveryFeeResult = {
  kind: DELIVERY_QUOTE_KIND.APPROXIMATE_MAX_TIER,
  feeInCents: 1000,
  tier: { maxDistanceKm: 8, feeInCents: 1000 },
  source: DELIVERY_LOCATION_SOURCE.CEP_APPROXIMATE,
}
const OUT_OF_RANGE: QuoteDeliveryFeeResult = { kind: DELIVERY_QUOTE_KIND.OUT_OF_RANGE, distanceKm: 12.36, maxDistanceKm: 8 }
const UNAVAILABLE: QuoteDeliveryFeeResult = {
  kind: DELIVERY_QUOTE_KIND.UNAVAILABLE,
  reason: DELIVERY_UNAVAILABLE_REASON.GEOCODING_FAILED,
}

const QUOTED_MESSAGE = MESSAGES.CHECKOUT_DELIVERY_FEE_QUOTED.replace('{distancia}', '2,4').replace('{valor}', formatPriceInCents(500))

type StateUpdate = { readonly currentState: string; readonly context: Record<string, unknown> }
type ButtonMessage = { readonly body: string; readonly buttons: readonly { readonly id: string; readonly title: string }[] }

function buildHarness(quoteResult: QuoteDeliveryFeeResult = QUOTED) {
  const texts: string[] = []
  const buttonMessages: ButtonMessage[] = []
  const stateUpdates: StateUpdate[] = []
  const quoteCalls: QuoteDeliveryFeeParams[] = []
  const createOrderCalls: Record<string, unknown>[] = []

  const dependencies = {
    conversationSessionRepository: {
      async updateStateByPhone(params: StateUpdate) {
        stateUpdates.push({ currentState: params.currentState, context: params.context })
        return undefined
      },
    },
    whatsAppSender: {
      async sendText(_phone: string, text: string) {
        texts.push(text)
      },
      async sendInteractiveButtons(_phone: string, body: string, buttons: ButtonMessage['buttons']) {
        buttonMessages.push({ body, buttons })
      },
    },
    cartRepository: {
      async findOpenByCustomer() {
        return { id: 'cart-1' }
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
    customerRepository: {},
    createOrderFromCartUseCase: {
      async execute(params: Record<string, unknown>) {
        createOrderCalls.push(params)
        return {
          order: {
            id: 'order-1',
            shortCode: 'QC-1',
            deliveryType: params.deliveryType,
            address: params.address,
            totalInCents: 5000,
            deliveryFeeInCents: params.quotedDeliveryFeeInCents,
            cashChangeForInCents: null,
          },
        }
      },
    },
    resolveOrderDeliveryEstimateUseCase: {},
    addressLookupProvider: {
      async lookupByCep(cep: string) {
        return cep === CEP ? VIACEP_ADDRESS : undefined
      },
    },
    storePreparationMinutes: 20,
    quoteDeliveryFeeUseCase: {
      async execute(params: QuoteDeliveryFeeParams): Promise<QuoteDeliveryFeeResult> {
        quoteCalls.push(params)
        return quoteResult
      },
    },
  } as unknown as CheckoutHandlerDependencies

  return { handler: new CheckoutHandler(dependencies), texts, buttonMessages, stateUpdates, quoteCalls, createOrderCalls }
}

function buildSession(currentState: string, context: ConversationContext): ConversationSession {
  return {
    id: 'session-1',
    customerPhone: PHONE,
    currentState,
    context,
    mode: 'bot',
    lastInteractionAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function text(body: string): ParsedInboundMessage {
  return { kind: 'text', from: PHONE, waMessageId: 'wa-1', body }
}

function button(buttonId: string): ParsedInboundMessage {
  return { kind: 'button_reply', from: PHONE, waMessageId: 'wa-1', buttonId, buttonTitle: '' }
}

const LOCATION_MESSAGE: ParsedInboundMessage = {
  kind: 'location',
  from: PHONE,
  waMessageId: 'wa-1',
  latitude: LATITUDE,
  longitude: LONGITUDE,
}

const DELIVERY_CONTEXT: ConversationContext = { checkoutDeliveryType: DELIVERY_TYPE.DELIVERY }
const APPROXIMATE_ADDRESS = { cep: CEP, ...VIACEP_ADDRESS, number: '412' }
const APPROXIMATE_PENDING = { feeInCents: 1000, tierMaxKm: 8, tierFeeInCents: 1000 }
const APPROXIMATE_DECISION_CONTEXT: ConversationContext = {
  ...DELIVERY_CONTEXT,
  checkoutAddress: APPROXIMATE_ADDRESS,
  checkoutApproximateDecision: APPROXIMATE_PENDING,
}
const CEP_DRAFT_CONTEXT: ConversationContext = { ...DELIVERY_CONTEXT, checkoutAddressDraft: { cep: CEP, ...VIACEP_ADDRESS } }

const QUOTE_KEYS = [
  'checkoutDeliveryFeeInCents',
  'checkoutDeliveryDistanceKm',
  'checkoutDeliveryTierMaxKm',
  'checkoutDeliveryTierFeeInCents',
  'checkoutDeliveryLocationSource',
] as const

function expectNoQuote(context: Record<string, unknown> | undefined): void {
  for (const key of QUOTE_KEYS) expect(context).not.toHaveProperty(key)
}

describe('CheckoutHandler — entrega por CEP (cotação quando o endereço fica pronto)', () => {
  it('CEP que resolve pede o número sem cotar ainda', async () => {
    const { handler, stateUpdates, texts, quoteCalls } = buildHarness()

    await handler.handle({ session: buildSession(CONVERSATION_STATE.AWAITING_ADDRESS, DELIVERY_CONTEXT), customer: CUSTOMER, message: text('01310-100') })

    expect(stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.AWAITING_ADDRESS_NUMBER)
    expect(stateUpdates[0]?.context.checkoutAddressDraft).toEqual({ cep: CEP, ...VIACEP_ADDRESS })
    expect(texts).toEqual([MESSAGES.CHECKOUT_ASK_ADDRESS_NUMBER])
    expect(quoteCalls).toEqual([])
  })

  it('quoted: cota pelo CEP ao receber o número, grava a cotação e mostra a taxa antes do pagamento', async () => {
    const { handler, stateUpdates, texts, buttonMessages, quoteCalls } = buildHarness(QUOTED)

    await handler.handle({ session: buildSession(CONVERSATION_STATE.AWAITING_ADDRESS_NUMBER, CEP_DRAFT_CONTEXT), customer: CUSTOMER, message: text('412, apto 71') })

    expect(quoteCalls).toEqual([{ deliveryType: DELIVERY_TYPE.DELIVERY, location: { kind: CUSTOMER_LOCATION_KIND.CEP, cep: CEP } }])
    expect(stateUpdates).toEqual([
      {
        currentState: CONVERSATION_STATE.AWAITING_PAYMENT,
        context: {
          checkoutDeliveryType: DELIVERY_TYPE.DELIVERY,
          checkoutDeliveryFeeInCents: 500,
          checkoutDeliveryDistanceKm: 2.43,
          checkoutDeliveryTierMaxKm: 3,
          checkoutDeliveryTierFeeInCents: 500,
          checkoutDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.CEP,
          checkoutAddress: { cep: CEP, street: 'Avenida Paulista', number: '412', complement: 'apto 71', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP' },
        },
      },
    ])
    expect(texts).toEqual([QUOTED_MESSAGE])
    expect(buttonMessages).toEqual([{ body: MESSAGES.CHECKOUT_ASK_PAYMENT, buttons: PAYMENT_METHOD_BUTTONS }])
  })

  it('approximate_max_tier: NÃO cobra ainda — confirma o endereço com o cliente antes (D3)', async () => {
    const { handler, stateUpdates, texts, buttonMessages } = buildHarness(APPROXIMATE)

    await handler.handle({ session: buildSession(CONVERSATION_STATE.AWAITING_ADDRESS_NUMBER, CEP_DRAFT_CONTEXT), customer: CUSTOMER, message: text('412') })

    const context = stateUpdates[0]?.context
    expect(stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.AWAITING_APPROXIMATE_ADDRESS_DECISION)
    expectNoQuote(context)
    expect(context?.checkoutApproximateDecision).toEqual({ feeInCents: 1000, tierMaxKm: 8, tierFeeInCents: 1000 })
    expect(context?.checkoutAddress).toEqual(APPROXIMATE_ADDRESS)
    expect(texts).toEqual([])
    expect(buttonMessages[0]?.buttons).toEqual(APPROXIMATE_ADDRESS_DECISION_BUTTONS)
    expect(buttonMessages[0]?.body).toContain('Avenida Paulista, 412')
    expect(buttonMessages[0]?.body).toContain('São Paulo')
    expect(buttonMessages[0]?.body).not.toContain(CEP)
  })

  it('out_of_range: vai para a decisão com distância e limite, sem endereço nem cotação no contexto', async () => {
    const { handler, stateUpdates, buttonMessages } = buildHarness(OUT_OF_RANGE)

    await handler.handle({ session: buildSession(CONVERSATION_STATE.AWAITING_ADDRESS_NUMBER, CEP_DRAFT_CONTEXT), customer: CUSTOMER, message: text('412') })

    expect(stateUpdates).toEqual([{ currentState: CONVERSATION_STATE.AWAITING_OUT_OF_RANGE_DECISION, context: DELIVERY_CONTEXT }])
    expect(buttonMessages).toEqual([
      {
        body: MESSAGES.CHECKOUT_DELIVERY_OUT_OF_RANGE.replace('{distancia}', '12,4').replace('{limite}', '8'),
        buttons: OUT_OF_RANGE_DECISION_BUTTONS,
      },
    ])
  })

  it('unavailable: mesma decisão, com a mensagem de que não deu para calcular', async () => {
    const { handler, stateUpdates, buttonMessages } = buildHarness(UNAVAILABLE)

    await handler.handle({ session: buildSession(CONVERSATION_STATE.AWAITING_ADDRESS_NUMBER, CEP_DRAFT_CONTEXT), customer: CUSTOMER, message: text('412') })

    expect(stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.AWAITING_OUT_OF_RANGE_DECISION)
    expect(buttonMessages).toEqual([{ body: MESSAGES.CHECKOUT_DELIVERY_UNAVAILABLE, buttons: OUT_OF_RANGE_DECISION_BUTTONS }])
  })

  it('CEP que não resolve não vira texto livre: pede CEP ou localização, com "Retirar na loja"', async () => {
    const { handler, stateUpdates, buttonMessages } = buildHarness()

    await handler.handle({ session: buildSession(CONVERSATION_STATE.AWAITING_ADDRESS, DELIVERY_CONTEXT), customer: CUSTOMER, message: text('99999-999') })

    expect(stateUpdates).toEqual([])
    expect(buttonMessages).toEqual([{ body: MESSAGES.CHECKOUT_ASK_ADDRESS_FALLBACK, buttons: ADDRESS_PICKUP_INSTEAD_BUTTONS }])
  })
})

describe('CheckoutHandler — texto livre sem CEP', () => {
  it('não serve para entrega: não grava endereço, pede CEP ou localização com "Retirar na loja"', async () => {
    const { handler, stateUpdates, buttonMessages, quoteCalls } = buildHarness()

    await handler.handle({ session: buildSession(CONVERSATION_STATE.AWAITING_ADDRESS, DELIVERY_CONTEXT), customer: CUSTOMER, message: text('Rua das Flores, 12, perto do mercado') })

    expect(stateUpdates).toEqual([])
    expect(quoteCalls).toEqual([])
    expect(buttonMessages).toEqual([{ body: MESSAGES.CHECKOUT_ADDRESS_NEEDS_CEP_OR_LOCATION, buttons: ADDRESS_PICKUP_INSTEAD_BUTTONS }])
  })

  it('"Retirar na loja" a partir do pedido de endereço vira retirada com taxa 0', async () => {
    const { handler, stateUpdates, buttonMessages, quoteCalls } = buildHarness()

    await handler.handle({
      session: buildSession(CONVERSATION_STATE.AWAITING_ADDRESS, DELIVERY_CONTEXT),
      customer: CUSTOMER,
      message: button(ADDRESS_DECISION_BUTTON_ID.PICKUP_INSTEAD),
    })

    expect(stateUpdates).toEqual([
      { currentState: CONVERSATION_STATE.AWAITING_PAYMENT, context: { checkoutDeliveryType: DELIVERY_TYPE.PICKUP, checkoutDeliveryFeeInCents: 0 } },
    ])
    expect(buttonMessages[0]?.body).toBe(MESSAGES.CHECKOUT_ASK_PAYMENT)
    expect(quoteCalls).toEqual([])
  })
})

describe('CheckoutHandler — entrega pela localização do WhatsApp', () => {
  it('quoted: cota pela coordenada, guarda a cotação e pede número/referência para o entregador', async () => {
    const { handler, stateUpdates, texts, quoteCalls } = buildHarness(QUOTED_BY_LOCATION)

    await handler.handle({ session: buildSession(CONVERSATION_STATE.AWAITING_ADDRESS, DELIVERY_CONTEXT), customer: CUSTOMER, message: LOCATION_MESSAGE })

    expect(quoteCalls).toEqual([
      { deliveryType: DELIVERY_TYPE.DELIVERY, location: { kind: CUSTOMER_LOCATION_KIND.COORDINATES, latitude: LATITUDE, longitude: LONGITUDE } },
    ])
    expect(stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.AWAITING_ADDRESS_NUMBER)
    expect(stateUpdates[0]?.context).toMatchObject({
      checkoutDeliveryFeeInCents: 500,
      checkoutDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.WHATSAPP_LOCATION,
      checkoutLocationDraft: { latitude: LATITUDE, longitude: LONGITUDE },
    })
    expect(texts).toEqual([QUOTED_MESSAGE, MESSAGES.CHECKOUT_ASK_LOCATION_ADDRESS_NUMBER])
  })

  it('número depois da localização grava lat/lng no endereço e segue ao pagamento sem recotar', async () => {
    const { handler, stateUpdates, buttonMessages, quoteCalls } = buildHarness()
    const quotedContext: ConversationContext = {
      ...DELIVERY_CONTEXT,
      checkoutDeliveryFeeInCents: 500,
      checkoutDeliveryDistanceKm: 2.43,
      checkoutDeliveryTierMaxKm: 3,
      checkoutDeliveryTierFeeInCents: 500,
      checkoutDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.WHATSAPP_LOCATION,
      checkoutLocationDraft: { latitude: LATITUDE, longitude: LONGITUDE },
    }

    await handler.handle({ session: buildSession(CONVERSATION_STATE.AWAITING_ADDRESS_NUMBER, quotedContext), customer: CUSTOMER, message: text('412, portão azul') })

    const { checkoutLocationDraft: _draft, ...expectedQuote } = quotedContext
    expect(stateUpdates).toEqual([
      {
        currentState: CONVERSATION_STATE.AWAITING_PAYMENT,
        context: { ...expectedQuote, checkoutAddress: { latitude: LATITUDE, longitude: LONGITUDE, number: '412', complement: 'portão azul' } },
      },
    ])
    expect(buttonMessages[0]?.body).toBe(MESSAGES.CHECKOUT_ASK_PAYMENT)
    expect(quoteCalls).toEqual([])
  })

  it('localização em AWAITING_ADDRESS_NUMBER (no lugar do número) é aceita como no passo do endereço', async () => {
    const { handler, stateUpdates, texts, quoteCalls } = buildHarness(QUOTED_BY_LOCATION)

    await handler.handle({
      session: buildSession(CONVERSATION_STATE.AWAITING_ADDRESS_NUMBER, CEP_DRAFT_CONTEXT),
      customer: CUSTOMER,
      message: LOCATION_MESSAGE,
    })

    expect(quoteCalls).toEqual([
      { deliveryType: DELIVERY_TYPE.DELIVERY, location: { kind: CUSTOMER_LOCATION_KIND.COORDINATES, latitude: LATITUDE, longitude: LONGITUDE } },
    ])
    expect(stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.AWAITING_ADDRESS_NUMBER)
    expect(stateUpdates[0]?.context).toMatchObject({ checkoutLocationDraft: { latitude: LATITUDE, longitude: LONGITUDE } })
    expect(stateUpdates[0]?.context).not.toHaveProperty('checkoutAddressDraft')
    expect(texts).toEqual([QUOTED_MESSAGE, MESSAGES.CHECKOUT_ASK_LOCATION_ADDRESS_NUMBER])
  })

  it('out_of_range pela localização: decisão, sem guardar a coordenada no contexto', async () => {
    const { handler, stateUpdates, buttonMessages } = buildHarness(OUT_OF_RANGE)

    await handler.handle({ session: buildSession(CONVERSATION_STATE.AWAITING_ADDRESS, DELIVERY_CONTEXT), customer: CUSTOMER, message: LOCATION_MESSAGE })

    expect(stateUpdates).toEqual([{ currentState: CONVERSATION_STATE.AWAITING_OUT_OF_RANGE_DECISION, context: DELIVERY_CONTEXT }])
    expect(buttonMessages[0]?.buttons).toEqual(OUT_OF_RANGE_DECISION_BUTTONS)
  })
})

describe('CheckoutHandler — AWAITING_OUT_OF_RANGE_DECISION', () => {
  it('"Retirar na loja" vira retirada com taxa 0 e segue ao pagamento', async () => {
    const { handler, stateUpdates, buttonMessages } = buildHarness()

    await handler.handle({
      session: buildSession(CONVERSATION_STATE.AWAITING_OUT_OF_RANGE_DECISION, DELIVERY_CONTEXT),
      customer: CUSTOMER,
      message: button(ADDRESS_DECISION_BUTTON_ID.PICKUP_INSTEAD),
    })

    expect(stateUpdates).toEqual([
      { currentState: CONVERSATION_STATE.AWAITING_PAYMENT, context: { checkoutDeliveryType: DELIVERY_TYPE.PICKUP, checkoutDeliveryFeeInCents: 0 } },
    ])
    expect(buttonMessages).toEqual([{ body: MESSAGES.CHECKOUT_ASK_PAYMENT, buttons: PAYMENT_METHOD_BUTTONS }])
  })

  it('"Outro endereço" volta a pedir o endereço, mantendo a entrega', async () => {
    const { handler, stateUpdates, texts } = buildHarness()

    await handler.handle({
      session: buildSession(CONVERSATION_STATE.AWAITING_OUT_OF_RANGE_DECISION, DELIVERY_CONTEXT),
      customer: CUSTOMER,
      message: button(ADDRESS_DECISION_BUTTON_ID.OTHER_ADDRESS),
    })

    expect(stateUpdates).toEqual([{ currentState: CONVERSATION_STATE.AWAITING_ADDRESS, context: DELIVERY_CONTEXT }])
    expect(texts).toEqual([MESSAGES.CHECKOUT_ASK_ADDRESS])
  })

  it('entrada inesperada repete as duas opções, sem mudar de estado', async () => {
    const { handler, stateUpdates, buttonMessages } = buildHarness()

    await handler.handle({ session: buildSession(CONVERSATION_STATE.AWAITING_OUT_OF_RANGE_DECISION, DELIVERY_CONTEXT), customer: CUSTOMER, message: text('entrega sim') })

    expect(stateUpdates).toEqual([])
    expect(buttonMessages).toEqual([{ body: MESSAGES.CHECKOUT_OUT_OF_RANGE_UNEXPECTED_INPUT, buttons: OUT_OF_RANGE_DECISION_BUTTONS }])
  })
})

describe('CheckoutHandler — "Isso mesmo" recota a entrega lembrada', () => {
  function rememberedContext(address: unknown): ConversationContext {
    return {
      rememberedCheckout: {
        deliveryType: DELIVERY_TYPE.DELIVERY,
        address,
        paymentMethod: PAYMENT_METHOD_BUTTON_ID.PIX,
        receiptPreference: RECEIPT_PREFERENCE.WHATSAPP,
      },
    }
  }

  it('recota ok pela coordenada lembrada e vai à confirmação com a taxa nova', async () => {
    const locationAddress = { latitude: LATITUDE, longitude: LONGITUDE, number: '412' }
    const { handler, stateUpdates, quoteCalls, texts } = buildHarness(QUOTED_BY_LOCATION)

    await handler.handle({
      session: buildSession(CONVERSATION_STATE.AWAITING_DELIVERY_TYPE, rememberedContext(locationAddress)),
      customer: CUSTOMER,
      message: button(REMEMBERED_CHECKOUT_BUTTON_ID.SAME_AS_LAST),
    })

    expect(quoteCalls[0]?.location).toEqual({ kind: CUSTOMER_LOCATION_KIND.COORDINATES, latitude: LATITUDE, longitude: LONGITUDE })
    expect(stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.CONFIRMING)
    expect(stateUpdates[0]?.context).toMatchObject({ checkoutDeliveryFeeInCents: 500, checkoutAddress: locationAddress })
    expect(texts).toEqual([QUOTED_MESSAGE])
  })

  it('recota fora do raio: descarta o atalho, avisa e volta à escolha do tipo de entrega', async () => {
    const { handler, stateUpdates, texts, buttonMessages } = buildHarness(OUT_OF_RANGE)

    await handler.handle({
      session: buildSession(CONVERSATION_STATE.AWAITING_DELIVERY_TYPE, rememberedContext({ cep: CEP, ...VIACEP_ADDRESS, number: '412' })),
      customer: CUSTOMER,
      message: button(REMEMBERED_CHECKOUT_BUTTON_ID.SAME_AS_LAST),
    })

    expect(stateUpdates).toEqual([{ currentState: CONVERSATION_STATE.AWAITING_DELIVERY_TYPE, context: {} }])
    expect(texts).toEqual([MESSAGES.CHECKOUT_REMEMBERED_DELIVERY_NOT_QUOTED])
    expect(buttonMessages).toEqual([{ body: MESSAGES.CHECKOUT_ASK_DELIVERY_TYPE, buttons: DELIVERY_TYPE_BUTTONS }])
  })

  it('endereço lembrado sem CEP nem coordenada (texto livre antigo): não cota e cai no caminho longo', async () => {
    const { handler, stateUpdates, quoteCalls, texts } = buildHarness()

    await handler.handle({
      session: buildSession(CONVERSATION_STATE.AWAITING_DELIVERY_TYPE, rememberedContext('Rua X, 123')),
      customer: CUSTOMER,
      message: button(REMEMBERED_CHECKOUT_BUTTON_ID.SAME_AS_LAST),
    })

    expect(quoteCalls).toEqual([])
    expect(stateUpdates).toEqual([{ currentState: CONVERSATION_STATE.AWAITING_DELIVERY_TYPE, context: {} }])
    expect(texts).toEqual([MESSAGES.CHECKOUT_REMEMBERED_DELIVERY_NOT_QUOTED])
  })

  it('retirada lembrada não cota: taxa 0', async () => {
    const { handler, stateUpdates, quoteCalls } = buildHarness()

    await handler.handle({
      session: buildSession(CONVERSATION_STATE.AWAITING_DELIVERY_TYPE, {
        rememberedCheckout: { deliveryType: DELIVERY_TYPE.PICKUP, paymentMethod: PAYMENT_METHOD_BUTTON_ID.PIX, receiptPreference: RECEIPT_PREFERENCE.WHATSAPP },
      }),
      customer: CUSTOMER,
      message: button(REMEMBERED_CHECKOUT_BUTTON_ID.SAME_AS_LAST),
    })

    expect(quoteCalls).toEqual([])
    expect(stateUpdates[0]?.context).toMatchObject({ checkoutDeliveryType: DELIVERY_TYPE.PICKUP, checkoutDeliveryFeeInCents: 0 })
  })
})

describe('CheckoutHandler — "Alterar" e a cotação', () => {
  it('"Alterar" não leva a cotação adiante; "Isso mesmo" depois recota', async () => {
    const quotedAddress = { cep: CEP, ...VIACEP_ADDRESS, number: '412' }
    const confirmingContext: ConversationContext = {
      checkoutDeliveryType: DELIVERY_TYPE.DELIVERY,
      checkoutDeliveryFeeInCents: 500,
      checkoutDeliveryDistanceKm: 2.43,
      checkoutDeliveryTierMaxKm: 3,
      checkoutDeliveryTierFeeInCents: 500,
      checkoutDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.CEP,
      checkoutAddress: quotedAddress,
      checkoutPaymentMethod: PAYMENT_METHOD_BUTTON_ID.PIX,
      checkoutReceiptPreference: RECEIPT_PREFERENCE.WHATSAPP,
    }
    const { handler, stateUpdates, quoteCalls } = buildHarness(APPROXIMATE)

    await handler.handle({ session: buildSession(CONVERSATION_STATE.CONFIRMING, confirmingContext), customer: CUSTOMER, message: button(CONFIRMING_BUTTON_ID.EDIT) })

    const afterEdit = stateUpdates[0]?.context
    expectNoQuote(afterEdit)
    expect(afterEdit?.rememberedCheckout).toMatchObject({ deliveryType: DELIVERY_TYPE.DELIVERY, address: quotedAddress })

    await handler.handle({
      session: buildSession(CONVERSATION_STATE.AWAITING_DELIVERY_TYPE, afterEdit ?? {}),
      customer: CUSTOMER,
      message: button(REMEMBERED_CHECKOUT_BUTTON_ID.SAME_AS_LAST),
    })

    expect(quoteCalls).toEqual([{ deliveryType: DELIVERY_TYPE.DELIVERY, location: { kind: CUSTOMER_LOCATION_KIND.CEP, cep: CEP } }])
    const afterRequote = stateUpdates[1]?.context
    expect(afterRequote).toMatchObject({ checkoutDeliveryFeeInCents: 1000, checkoutDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.CEP_APPROXIMATE })
    expect(afterRequote).not.toHaveProperty('checkoutDeliveryDistanceKm')
  })

  it('"Quero mudar" e o clique em "Entrega" apagam uma cotação que estivesse no contexto', async () => {
    const staleQuote: ConversationContext = {
      checkoutDeliveryFeeInCents: 500,
      checkoutDeliveryDistanceKm: 2.43,
      checkoutDeliveryTierMaxKm: 3,
      checkoutDeliveryTierFeeInCents: 500,
      checkoutDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.CEP,
    }
    const { handler, stateUpdates } = buildHarness()

    await handler.handle({ session: buildSession(CONVERSATION_STATE.AWAITING_DELIVERY_TYPE, staleQuote), customer: CUSTOMER, message: button(DELIVERY_TYPE_BUTTON_ID.DELIVERY) })

    expectNoQuote(stateUpdates[0]?.context)
  })
})

describe('CheckoutHandler — pagamento depois de voltar ao endereço', () => {
  it('escolher outro pagamento descarta o troco de uma escolha anterior', async () => {
    const { handler, stateUpdates } = buildHarness()

    await handler.handle({
      session: buildSession(CONVERSATION_STATE.AWAITING_PAYMENT, { checkoutDeliveryType: DELIVERY_TYPE.PICKUP, checkoutDeliveryFeeInCents: 0, checkoutCashChangeForInCents: 10000 }),
      customer: CUSTOMER,
      message: button(PAYMENT_METHOD_BUTTON_ID.PIX),
    })

    expect(stateUpdates[0]?.context).not.toHaveProperty('checkoutCashChangeForInCents')
  })
})

describe('CheckoutHandler — coordenada nunca em log', () => {
  const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const
  let logged: string[] = []
  let spies: ReturnType<typeof spyOn>[] = []

  // No método público do Logger, antes do filtro de nível: um log de debug também não pode levar a coordenada.
  beforeEach(() => {
    logged = []
    spies = LOG_LEVELS.map((level) =>
      spyOn(Logger.prototype, level).mockImplementation((message: string, meta?: unknown) => {
        logged.push(`${message} ${JSON.stringify(meta ?? null)}`)
      }),
    )
  })

  afterEach(() => {
    for (const spy of spies) spy.mockRestore()
  })

  it('localização recebida, cotada, completada e confirmada: nenhum log contém latitude ou longitude', async () => {
    const { handler, stateUpdates } = buildHarness(QUOTED_BY_LOCATION)

    await handler.handle({ session: buildSession(CONVERSATION_STATE.AWAITING_ADDRESS, DELIVERY_CONTEXT), customer: CUSTOMER, message: LOCATION_MESSAGE })
    await handler.handle({ session: buildSession(CONVERSATION_STATE.AWAITING_ADDRESS_NUMBER, stateUpdates[0]?.context ?? {}), customer: CUSTOMER, message: text('412') })
    await handler.handle({
      session: buildSession(CONVERSATION_STATE.CONFIRMING, {
        ...stateUpdates[1]?.context,
        checkoutPaymentMethod: PAYMENT_METHOD_BUTTON_ID.PIX,
        checkoutReceiptPreference: RECEIPT_PREFERENCE.WHATSAPP,
      }),
      customer: CUSTOMER,
      message: button(CONFIRMING_BUTTON_ID.CONFIRM),
    })

    // O caminho da previsão de entrega falha (dublê vazio) e loga: prova que houve log para inspecionar.
    expect(logged.length).toBeGreaterThan(0)
    const allLogs = logged.join('\n')
    expect(allLogs).not.toContain(String(LATITUDE))
    expect(allLogs).not.toContain(String(LONGITUDE))
    expect(allLogs).not.toContain('23.5613')
    expect(allLogs).not.toContain('46.6565')
  })
})

/**
 * Decisão do usuário (D3): cotação aproximada não vira cobrança em silêncio. O cliente confirma o
 * endereço antes — mandando a localização, trocando o endereço, retirando na loja ou, se a
 * localização não vier, aceitando a estimativa com o preço na tela.
 */
describe('CheckoutHandler — confirmação de endereço aproximado', () => {
  it('"Enviar localização" explica como enviar e passa a esperar a localização no mesmo estado', async () => {
    const { handler, stateUpdates, texts } = buildHarness(APPROXIMATE)

    await handler.handle({
      session: buildSession(CONVERSATION_STATE.AWAITING_APPROXIMATE_ADDRESS_DECISION, APPROXIMATE_DECISION_CONTEXT),
      customer: CUSTOMER,
      message: button(APPROXIMATE_ADDRESS_BUTTON_ID.SEND_LOCATION),
    })

    expect(stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.AWAITING_APPROXIMATE_ADDRESS_DECISION)
    expect(stateUpdates[0]?.context.checkoutApproximateDecision).toEqual({ ...APPROXIMATE_PENDING, awaitingLocation: true, locationAttempts: 0 })
    expect(texts).toEqual([MESSAGES.CHECKOUT_APPROXIMATE_ASK_LOCATION])
  })

  it('localização recebida no estado novo cota pela coordenada exata e segue para o pagamento', async () => {
    const { handler, stateUpdates, texts, buttonMessages, quoteCalls } = buildHarness(QUOTED_BY_LOCATION)

    await handler.handle({
      session: buildSession(CONVERSATION_STATE.AWAITING_APPROXIMATE_ADDRESS_DECISION, {
        ...APPROXIMATE_DECISION_CONTEXT,
        checkoutApproximateDecision: { ...APPROXIMATE_PENDING, awaitingLocation: true, locationAttempts: 0 },
      }),
      customer: CUSTOMER,
      message: LOCATION_MESSAGE,
    })

    expect(quoteCalls).toEqual([
      { deliveryType: DELIVERY_TYPE.DELIVERY, location: { kind: CUSTOMER_LOCATION_KIND.COORDINATES, latitude: LATITUDE, longitude: LONGITUDE } },
    ])
    const context = stateUpdates[0]?.context
    expect(stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.AWAITING_PAYMENT)
    expect(context).toMatchObject({
      checkoutDeliveryFeeInCents: 500,
      checkoutDeliveryDistanceKm: 2.43,
      checkoutDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.WHATSAPP_LOCATION,
      checkoutAddress: APPROXIMATE_ADDRESS,
    })
    expect(context).not.toHaveProperty('checkoutApproximateDecision')
    expect(texts).toEqual([QUOTED_MESSAGE])
    expect(buttonMessages).toEqual([{ body: MESSAGES.CHECKOUT_ASK_PAYMENT, buttons: PAYMENT_METHOD_BUTTONS }])
  })

  it('"Alterar endereço" volta ao endereço e apaga endereço e estimativa pendente', async () => {
    const { handler, stateUpdates, texts } = buildHarness(APPROXIMATE)

    await handler.handle({
      session: buildSession(CONVERSATION_STATE.AWAITING_APPROXIMATE_ADDRESS_DECISION, APPROXIMATE_DECISION_CONTEXT),
      customer: CUSTOMER,
      message: button(APPROXIMATE_ADDRESS_BUTTON_ID.CHANGE_ADDRESS),
    })

    expect(stateUpdates).toEqual([{ currentState: CONVERSATION_STATE.AWAITING_ADDRESS, context: DELIVERY_CONTEXT }])
    expectNoQuote(stateUpdates[0]?.context)
    expect(stateUpdates[0]?.context).not.toHaveProperty('checkoutApproximateDecision')
    expect(texts).toEqual([MESSAGES.CHECKOUT_ASK_ADDRESS])
  })

  it('"Retirar na loja" fecha em retirada com taxa 0', async () => {
    const { handler, stateUpdates, buttonMessages } = buildHarness(APPROXIMATE)

    await handler.handle({
      session: buildSession(CONVERSATION_STATE.AWAITING_APPROXIMATE_ADDRESS_DECISION, APPROXIMATE_DECISION_CONTEXT),
      customer: CUSTOMER,
      message: button(ADDRESS_DECISION_BUTTON_ID.PICKUP_INSTEAD),
    })

    expect(stateUpdates).toEqual([
      { currentState: CONVERSATION_STATE.AWAITING_PAYMENT, context: { checkoutDeliveryType: DELIVERY_TYPE.PICKUP, checkoutDeliveryFeeInCents: 0 } },
    ])
    expect(buttonMessages).toEqual([{ body: MESSAGES.CHECKOUT_ASK_PAYMENT, buttons: PAYMENT_METHOD_BUTTONS }])
  })

  it('CEP de 8 dígitos em texto vale como endereço novo', async () => {
    const { handler, stateUpdates, texts } = buildHarness(APPROXIMATE)

    await handler.handle({
      session: buildSession(CONVERSATION_STATE.AWAITING_APPROXIMATE_ADDRESS_DECISION, APPROXIMATE_DECISION_CONTEXT),
      customer: CUSTOMER,
      message: text('01310-100'),
    })

    expect(stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.AWAITING_ADDRESS_NUMBER)
    expect(stateUpdates[0]?.context.checkoutAddressDraft).toEqual({ cep: CEP, ...VIACEP_ADDRESS })
    expect(stateUpdates[0]?.context).not.toHaveProperty('checkoutApproximateDecision')
    expect(texts).toEqual([MESSAGES.CHECKOUT_ASK_ADDRESS_NUMBER])
  })

  it('texto que não é CEP repete a pergunta uma vez e depois vira mensagem de ajuda, sem sair do estado', async () => {
    const { handler, stateUpdates, buttonMessages } = buildHarness(APPROXIMATE)

    await handler.handle({
      session: buildSession(CONVERSATION_STATE.AWAITING_APPROXIMATE_ADDRESS_DECISION, APPROXIMATE_DECISION_CONTEXT),
      customer: CUSTOMER,
      message: text('pode mandar'),
    })
    await handler.handle({
      session: buildSession(CONVERSATION_STATE.AWAITING_APPROXIMATE_ADDRESS_DECISION, stateUpdates[0]?.context as ConversationContext),
      customer: CUSTOMER,
      message: text('pode mandar'),
    })

    expect(stateUpdates.map((update) => update.currentState)).toEqual([
      CONVERSATION_STATE.AWAITING_APPROXIMATE_ADDRESS_DECISION,
      CONVERSATION_STATE.AWAITING_APPROXIMATE_ADDRESS_DECISION,
    ])
    expect(buttonMessages).toEqual([
      { body: MESSAGES.CHECKOUT_APPROXIMATE_UNEXPECTED_INPUT, buttons: APPROXIMATE_ADDRESS_DECISION_BUTTONS },
      { body: MESSAGES.CHECKOUT_APPROXIMATE_HELP, buttons: APPROXIMATE_ADDRESS_DECISION_BUTTONS },
    ])
  })

  it('duas mensagens que não são localização levam à oferta da estimativa com o preço', async () => {
    const { handler, stateUpdates, texts, buttonMessages } = buildHarness(APPROXIMATE)
    let context: ConversationContext = { ...APPROXIMATE_DECISION_CONTEXT, checkoutApproximateDecision: { ...APPROXIMATE_PENDING, awaitingLocation: true, locationAttempts: 0 } }

    for (const body of ['aqui em casa', 'não sei mandar']) {
      await handler.handle({ session: buildSession(CONVERSATION_STATE.AWAITING_APPROXIMATE_ADDRESS_DECISION, context), customer: CUSTOMER, message: text(body) })
      context = stateUpdates[stateUpdates.length - 1]?.context as ConversationContext
    }

    expect(texts).toEqual([MESSAGES.CHECKOUT_APPROXIMATE_ASK_LOCATION])
    expect(buttonMessages).toEqual([
      { body: MESSAGES.CHECKOUT_APPROXIMATE_ESTIMATE_OFFER.replace('{valor}', formatPriceInCents(1000)), buttons: APPROXIMATE_ESTIMATE_BUTTONS },
    ])
    expect(context.checkoutApproximateDecision).toEqual({ ...APPROXIMATE_PENDING, locationAttempts: 2, awaitingLocation: false })
    expectNoQuote(context as Record<string, unknown>)
  })

  it('confirmar a estimativa grava a cotação aproximada e o pedido sai com fonte cep_approximate', async () => {
    const { handler, stateUpdates, texts, createOrderCalls } = buildHarness(APPROXIMATE)

    await handler.handle({
      session: buildSession(CONVERSATION_STATE.AWAITING_APPROXIMATE_ADDRESS_DECISION, {
        ...APPROXIMATE_DECISION_CONTEXT,
        checkoutApproximateDecision: { ...APPROXIMATE_PENDING, locationAttempts: 2 },
      }),
      customer: CUSTOMER,
      message: button(APPROXIMATE_ADDRESS_BUTTON_ID.CONFIRM_ESTIMATE),
    })

    const quotedContext = stateUpdates[0]?.context as ConversationContext
    expect(stateUpdates[0]?.currentState).toBe(CONVERSATION_STATE.AWAITING_PAYMENT)
    expect(quotedContext).toMatchObject({
      checkoutDeliveryFeeInCents: 1000,
      checkoutDeliveryTierMaxKm: 8,
      checkoutDeliveryTierFeeInCents: 1000,
      checkoutDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.CEP_APPROXIMATE,
      checkoutAddress: APPROXIMATE_ADDRESS,
    })
    expect(quotedContext).not.toHaveProperty('checkoutDeliveryDistanceKm')
    expect(quotedContext).not.toHaveProperty('checkoutApproximateDecision')
    expect(texts).toEqual([MESSAGES.CHECKOUT_DELIVERY_FEE_APPROXIMATE.replace('{valor}', formatPriceInCents(1000))])

    await handler.handle({
      session: buildSession(CONVERSATION_STATE.CONFIRMING, {
        ...quotedContext,
        checkoutPaymentMethod: PAYMENT_METHOD_BUTTON_ID.PIX,
        checkoutReceiptPreference: RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP,
      }),
      customer: CUSTOMER,
      message: button(CONFIRMING_BUTTON_ID.CONFIRM),
    })

    expect(createOrderCalls[0]).toMatchObject({
      quotedDeliveryFeeInCents: 1000,
      quotedDeliveryTierMaxKm: 8,
      quotedDeliveryTierFeeInCents: 1000,
      quotedDeliveryLocationSource: DELIVERY_LOCATION_SOURCE.CEP_APPROXIMATE,
      quotedDeliveryDistanceKm: null,
    })
  })
})
