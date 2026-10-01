/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Entrega sem cotação por faixa no contexto — sessão de antes do deploy, quando a taxa saía da env no
 * clique em "Entrega". Não há taxa honesta para mostrar nem para validar o troco, então o cliente volta
 * ao endereço: o CEP ou a localização geram a cotação, e o pagamento é perguntado de novo depois dela.
 */

import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { withoutCheckoutAddress, withoutDeliveryQuote } from '@/modules/conversation/shared/deliveryQuoteContext'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import type { UpdateConversationSessionStateByPhoneParams } from '@/modules/webhook/domain/ConversationSessionRepository.interface'

export type ReturnToAddressForMissingQuoteParams = {
  readonly dependencies: {
    readonly conversationSessionRepository: {
      updateStateByPhone(params: UpdateConversationSessionStateByPhoneParams): Promise<unknown>
    }
    readonly whatsAppSender: { sendText(phone: string, text: string): Promise<unknown> }
  }
  readonly customerPhone: string
  readonly checkoutContext: ConversationContext
}

export async function returnToAddressForMissingQuote(params: ReturnToAddressForMissingQuoteParams): Promise<void> {
  const { dependencies, customerPhone, checkoutContext } = params
  // O troco foi (ou seria) validado sem taxa: some junto, para ser perguntado de novo contra a cotação.
  const next: Record<string, unknown> = { ...withoutCheckoutAddress(withoutDeliveryQuote(checkoutContext)) }
  delete next.checkoutCashChangeForInCents

  await dependencies.conversationSessionRepository.updateStateByPhone({
    customerPhone,
    currentState: CONVERSATION_STATE.AWAITING_ADDRESS,
    context: next,
  })
  await dependencies.whatsAppSender.sendText(customerPhone, MESSAGES.CHECKOUT_DELIVERY_QUOTE_MISSING)
}
