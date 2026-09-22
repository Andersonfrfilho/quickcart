/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Troco no pagamento em dinheiro (roteiro §9, spec §3.1), num arquivo próprio: o
 * `CheckoutHandler` já tem ~490 linhas (spec, risco), e estes dois estados só existem
 * quando o pagamento escolhido é `cash` — cabem soltos daquele fluxo principal.
 * `AWAITING_PAYMENT` (no `CheckoutHandler`) decide se entra aqui; ao terminar, este
 * handler devolve o cliente para `AWAITING_RECEIPT_PREFERENCE`, exatamente onde o
 * `CheckoutHandler` o deixaria sem troco.
 *
 * Exceção (correção T1.1/T1.2): quando o troco nasce do atalho de checkout lembrado, o
 * contexto já chega com `checkoutReceiptPreference` preenchido — perguntar de novo seria
 * repetir algo que o cliente já confirmou no pedido anterior. Neste caso, ao terminar,
 * vai direto para `enterConfirming` (mesma função compartilhada do `CheckoutHandler`).
 */

import type { ConversationHandlerContext, ConversationHandlerInterface } from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import { calculateAmountDueInCents } from '@/modules/conversation/application/handlers/support/amountDue'
import { calculateCartTotalInCents } from '@/modules/conversation/application/handlers/support/cartTotal'
import { enterConfirming, type EnterConfirmingDependencies } from '@/modules/conversation/application/handlers/support/enterConfirming'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'
import {
  CASH_CHANGE_BUTTON_ID,
  CASH_CHANGE_BUTTONS,
  MESSAGES,
  RECEIPT_PREFERENCE_BUTTONS,
} from '@/modules/conversation/shared/Messages.constant'
import { parseCashAmountToCents } from '@/modules/conversation/shared/parseCashAmountToCents'
import { CHANNEL } from '@/modules/shared/shared.constant'

/** Portas estreitas: só o que este handler usa, para o teste não precisar de repositório inteiro. */
export type CashChangeHandlerDependencies = EnterConfirmingDependencies

export class CashChangeHandler implements ConversationHandlerInterface {
  constructor(private readonly dependencies: CashChangeHandlerDependencies) {}

  async handle(context: ConversationHandlerContext): Promise<void> {
    switch (context.session.currentState) {
      case CONVERSATION_STATE.AWAITING_CASH_CHANGE:
        await this.handleAwaitingCashChange(context)
        return
      default:
        await this.handleAwaitingCashChangeAmount(context)
    }
  }

  private async handleAwaitingCashChange({ session, customer, message }: ConversationHandlerContext): Promise<void> {
    const checkoutContext = (session.context ?? {}) as ConversationContext

    if (message.kind !== 'button_reply') {
      await this.dependencies.whatsAppSender.sendInteractiveButtons(
        session.customerPhone,
        MESSAGES.CHECKOUT_ASK_CASH_CHANGE,
        CASH_CHANGE_BUTTONS,
      )
      return
    }

    if (message.buttonId === CASH_CHANGE_BUTTON_ID.NOT_NEEDED) {
      await this.finishCashChange(session.customerPhone, customer.id, {
        ...checkoutContext,
        checkoutCashChangeForInCents: null,
      })
      return
    }

    if (message.buttonId === CASH_CHANGE_BUTTON_ID.NEEDED) {
      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.AWAITING_CASH_CHANGE_AMOUNT,
        context: checkoutContext,
      })
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CHECKOUT_ASK_CASH_CHANGE_AMOUNT)
      return
    }

    await this.dependencies.whatsAppSender.sendInteractiveButtons(
      session.customerPhone,
      MESSAGES.CHECKOUT_ASK_CASH_CHANGE,
      CASH_CHANGE_BUTTONS,
    )
  }

  private async handleAwaitingCashChangeAmount({ session, customer, message }: ConversationHandlerContext): Promise<void> {
    const checkoutContext = (session.context ?? {}) as ConversationContext

    if (message.kind !== 'text') {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CHECKOUT_CASH_CHANGE_INVALID)
      return
    }

    const cashChangeForInCents = parseCashAmountToCents(message.body)
    if (cashChangeForInCents === undefined) {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CHECKOUT_CASH_CHANGE_INVALID)
      return
    }

    const cart = await this.dependencies.cartRepository.findOpenByCustomer(customer.id, CHANNEL.WHATSAPP)
    const cartTotalInCents = cart
      ? await calculateCartTotalInCents({
          cartId: cart.id,
          cartRepository: this.dependencies.cartRepository,
          productRepository: this.dependencies.productRepository,
        })
      : 0
    const amountDueInCents = calculateAmountDueInCents(cartTotalInCents)

    if (cashChangeForInCents <= amountDueInCents) {
      await this.dependencies.whatsAppSender.sendText(
        session.customerPhone,
        MESSAGES.CHECKOUT_CASH_CHANGE_TOO_LOW.replace('{total}', formatPriceInCents(amountDueInCents)),
      )
      return
    }

    await this.finishCashChange(session.customerPhone, customer.id, { ...checkoutContext, checkoutCashChangeForInCents: cashChangeForInCents })
  }

  /**
   * Correção T1.1/T1.2: o atalho de checkout lembrado já traz `checkoutReceiptPreference`
   * preenchido — perguntar de novo repetiria algo que o cliente já respondeu no pedido
   * anterior. Sem essa memória (fluxo normal), segue perguntando o recibo como sempre.
   */
  private async finishCashChange(customerPhone: string, customerId: string, context: ConversationContext): Promise<void> {
    if (context.checkoutReceiptPreference) {
      await enterConfirming({ dependencies: this.dependencies, customerPhone, customerId, checkoutContext: context })
      return
    }

    await this.goToReceiptPreference(customerPhone, context)
  }

  private async goToReceiptPreference(customerPhone: string, context: ConversationContext): Promise<void> {
    await this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone,
      currentState: CONVERSATION_STATE.AWAITING_RECEIPT_PREFERENCE,
      context,
    })
    await this.dependencies.whatsAppSender.sendInteractiveButtons(
      customerPhone,
      MESSAGES.CHECKOUT_ASK_RECEIPT_PREFERENCE,
      RECEIPT_PREFERENCE_BUTTONS,
    )
  }
}
