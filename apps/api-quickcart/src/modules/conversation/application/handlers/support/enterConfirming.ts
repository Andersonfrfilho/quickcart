/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Entrada única na confirmação final (spec §3.4/T1.1 correção): extraída do
 * `CheckoutHandler` para o `CashChangeHandler` também poder ir direto à confirmação
 * quando o atalho lembrado já trouxe o recibo — sem duplicar a montagem do resumo.
 */

import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'
import {
  CONFIRMING_BUTTONS,
  MESSAGES,
  PAYMENT_METHOD_BUTTONS,
  RECEIPT_PREFERENCE_BUTTONS,
} from '@/modules/conversation/shared/Messages.constant'
import { formatAddressLine } from '@/modules/shared/address/formatAddressLine'
import { formatDistanceKm } from '@/shared/formatDistanceKm'
import { DELIVERY_LOCATION_SOURCE } from '@/modules/order/shared/DeliveryFeeQuote.constant'
import { CHANNEL } from '@/modules/shared/shared.constant'
import type { UpdateConversationSessionStateByPhoneParams } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { amountDueInCents } from '@/modules/order/shared/amountDue'
import { resolveCheckoutDeliveryFeeInCents } from '@/modules/conversation/shared/resolveCheckoutDeliveryFeeInCents'
import { DELIVERY_TYPE } from '@/modules/order/shared/Order.constant'
import { returnToAddressForMissingQuote } from '@/modules/conversation/application/handlers/support/returnToAddressForMissingQuote'

type InteractiveButtonOption = { readonly id: string; readonly title: string }

/** Portas estreitas: só o que a confirmação usa, para o teste não precisar de repositório inteiro. */
export type EnterConfirmingDependencies = {
  readonly cartRepository: {
    findOpenByCustomer(customerId: string, channel: string): Promise<{ readonly id: string } | undefined>
    listItems(cartId: string): Promise<ReadonlyArray<{ readonly productId: string; readonly quantity: number }>>
  }
  readonly productRepository: {
    findById(id: string): Promise<{ readonly name: string; readonly priceInCents: number } | undefined>
  }
  readonly conversationSessionRepository: {
    updateStateByPhone(params: UpdateConversationSessionStateByPhoneParams): Promise<unknown>
  }
  readonly whatsAppSender: {
    sendText(phone: string, text: string): Promise<unknown>
    sendInteractiveButtons(phone: string, bodyText: string, buttons: ReadonlyArray<InteractiveButtonOption>): Promise<unknown>
  }
}

export type EnterConfirmingParams = {
  readonly dependencies: EnterConfirmingDependencies
  readonly customerPhone: string
  readonly customerId: string
  readonly checkoutContext: ConversationContext
}

function describeSelection(buttons: ReadonlyArray<InteractiveButtonOption>, id: string | undefined): string {
  return buttons.find((button) => button.id === id)?.title ?? ''
}

/**
 * Prefixo da linha de taxa (spec §3.4): com faixa conhecida, mostra o teto e a distância; na
 * precisão de cidade (D3), só o teto, marcado como estimativa. Sem faixa no contexto (sessão
 * anterior a esta task, embora já cotada), cai no rótulo simples de sempre.
 */
function buildDeliveryFeePrefix(checkoutContext: ConversationContext): string {
  const tierMaxKm = checkoutContext.checkoutDeliveryTierMaxKm
  if (tierMaxKm === undefined) return MESSAGES.CONFIRMING_SUMMARY_DELIVERY_FEE_PREFIX

  if (checkoutContext.checkoutDeliveryLocationSource === DELIVERY_LOCATION_SOURCE.CEP_APPROXIMATE) {
    return MESSAGES.CONFIRMING_SUMMARY_DELIVERY_FEE_APPROXIMATE_PREFIX.replace('{limite}', formatDistanceKm(tierMaxKm))
  }

  const distanceKm = checkoutContext.checkoutDeliveryDistanceKm
  if (distanceKm === undefined) return MESSAGES.CONFIRMING_SUMMARY_DELIVERY_FEE_PREFIX

  return MESSAGES.CONFIRMING_SUMMARY_DELIVERY_FEE_QUOTED_PREFIX.replace('{limite}', formatDistanceKm(tierMaxKm)).replace(
    '{distancia}',
    formatDistanceKm(distanceKm),
  )
}

type BuildConfirmingSummaryParams = {
  readonly dependencies: EnterConfirmingDependencies
  readonly cartId: string
  readonly checkoutContext: ConversationContext
  readonly deliveryFeeInCents: number
}

async function buildConfirmingSummary(params: BuildConfirmingSummaryParams): Promise<string> {
  const { dependencies, cartId, checkoutContext, deliveryFeeInCents } = params
  const cartItems = await dependencies.cartRepository.listItems(cartId)
  const products = await Promise.all(cartItems.map((item) => dependencies.productRepository.findById(item.productId)))

  let totalInCents = 0
  const lines = cartItems.map((item, index) => {
    const product = products[index]
    const lineTotalInCents = Math.round((product?.priceInCents ?? 0) * item.quantity)
    totalInCents += lineTotalInCents
    return `• ${item.quantity}x ${product?.name ?? item.productId} — ${formatPriceInCents(lineTotalInCents)}`
  })

  const isPickup = checkoutContext.checkoutDeliveryType === DELIVERY_TYPE.PICKUP
  const amountDue = amountDueInCents({ totalInCents, deliveryFeeInCents })

  /*
   * `String(objeto)` virava "[object Object]" desde que o endereço passou a nascer estruturado
   * (T2.2) — `formatAddressLine` entende os dois formatos, o novo e o texto livre de quem já
   * estava no meio do checkout antes do deploy.
   */
  const formattedAddress = formatAddressLine(checkoutContext.checkoutAddress)
  const deliveryLine = isPickup
    ? `${MESSAGES.CONFIRMING_SUMMARY_DELIVERY_PREFIX} ${MESSAGES.CONFIRMING_SUMMARY_PICKUP_LABEL}`
    : `${MESSAGES.CONFIRMING_SUMMARY_DELIVERY_PREFIX} ${formattedAddress ?? ''}`.trim()
  const cashChangeForInCents = checkoutContext.checkoutCashChangeForInCents
  const paymentLine =
    `${MESSAGES.CONFIRMING_SUMMARY_PAYMENT_PREFIX} ` +
    describeSelection(PAYMENT_METHOD_BUTTONS, checkoutContext.checkoutPaymentMethod) +
    (typeof cashChangeForInCents === 'number'
      ? MESSAGES.CASH_CHANGE_SUMMARY_SUFFIX.replace('{valor}', formatPriceInCents(cashChangeForInCents))
      : '')
  const receiptLine = `${MESSAGES.CONFIRMING_SUMMARY_RECEIPT_PREFIX} ${describeSelection(RECEIPT_PREFERENCE_BUTTONS, checkoutContext.checkoutReceiptPreference)}`

  return [
    MESSAGES.CONFIRMING_SUMMARY_HEADER,
    MESSAGES.CONFIRMING_SUMMARY_ITEMS_LABEL,
    ...lines,
    `${MESSAGES.CONFIRMING_SUMMARY_SUBTOTAL_PREFIX} ${formatPriceInCents(totalInCents)}`,
    // Ausente na retirada (spec §3.4): não há taxa a mostrar quando ela nunca será cobrada.
    ...(isPickup
      ? []
      : [
          `${buildDeliveryFeePrefix(checkoutContext)} ${
            deliveryFeeInCents > 0 ? formatPriceInCents(deliveryFeeInCents) : MESSAGES.CONFIRMING_SUMMARY_DELIVERY_FEE_FREE
          }`,
        ]),
    `${MESSAGES.CONFIRMING_SUMMARY_TOTAL_PREFIX} ${formatPriceInCents(amountDue)}`,
    deliveryLine,
    paymentLine,
    receiptLine,
    '',
    MESSAGES.CONFIRMING_ASK,
  ]
    .filter((line) => line !== undefined)
    .join('\n')
}

export async function enterConfirming(params: EnterConfirmingParams): Promise<void> {
  const { dependencies, customerPhone, customerId, checkoutContext } = params

  const cart = await dependencies.cartRepository.findOpenByCustomer(customerId, CHANNEL.WHATSAPP)
  if (!cart) {
    await dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone,
      currentState: CONVERSATION_STATE.GREETING,
      context: {},
    })
    await dependencies.whatsAppSender.sendText(customerPhone, MESSAGES.ORDER_CART_EMPTY_ERROR)
    return
  }

  /*
   * A taxa vem da cotação gravada no contexto quando o endereço ficou pronto — não recotada aqui: o
   * resumo precisa bater com o que será cobrado e com o troco já validado. Sem cotação, volta ao endereço.
   */
  const deliveryFeeInCents = resolveCheckoutDeliveryFeeInCents(checkoutContext)
  if (deliveryFeeInCents === undefined) {
    await returnToAddressForMissingQuote({ dependencies, customerPhone, checkoutContext })
    return
  }

  const summaryText = await buildConfirmingSummary({ dependencies, cartId: cart.id, checkoutContext, deliveryFeeInCents })

  await dependencies.conversationSessionRepository.updateStateByPhone({
    customerPhone,
    currentState: CONVERSATION_STATE.CONFIRMING,
    context: checkoutContext,
  })
  await dependencies.whatsAppSender.sendInteractiveButtons(customerPhone, summaryText, CONFIRMING_BUTTONS)
}
