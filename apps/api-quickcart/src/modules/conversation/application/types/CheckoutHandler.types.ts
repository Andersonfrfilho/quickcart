/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { Customer } from '@/infra/database/schema'
import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import type { DeliveryQuoteContext } from '@/modules/conversation/shared/deliveryQuoteContext'
import type { QuoteDeliveryFeeResult } from '@/modules/order/application/types/QuoteDeliveryFee.types'

export type AskCashChangeAgainParams = {
  readonly session: ConversationSession
  readonly cartId: string
  readonly checkoutContext: ConversationContext
  readonly deliveryFeeInCents: number
}

export type CheckoutStepParams = {
  readonly session: ConversationSession
  readonly checkoutContext: ConversationContext
}

export type ApplyRememberedCheckoutParams = CheckoutStepParams & {
  readonly customer: Customer
  readonly remembered: NonNullable<ConversationContext['rememberedCheckout']>
}

export type DeclineDeliveryParams = CheckoutStepParams & {
  readonly result: QuoteDeliveryFeeResult
}

export type AcceptLocationParams = CheckoutStepParams & {
  readonly coordinates: { readonly latitude: number; readonly longitude: number }
}

export type AskPaymentAfterQuoteParams = {
  readonly session: ConversationSession
  readonly context: ConversationContext
  readonly quoteMessage?: string
}

/** Cotação que permite entregar: o que vai para o contexto e o texto que o cliente vê. */
export type AcceptedDeliveryQuote = {
  readonly context: DeliveryQuoteContext
  readonly message: string
}

export type DeliveryQuoteOutcome = {
  readonly result: QuoteDeliveryFeeResult
  readonly accepted?: AcceptedDeliveryQuote
}
