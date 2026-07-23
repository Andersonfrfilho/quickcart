/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Regras transversais (spec §4 / docs/CONVERSATION_FLOW.md): rodam antes do handler
 * do estado, em qualquer estado. `repeat_order` copia os itens do último pedido pra
 * um carrinho aberto via RepeatLastOrderUseCase e cai em cart_review — itens sem
 * produto disponível são reportados, e sem pedido anterior apenas avisa que não há
 * nada pra repetir.
 */

import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { RepeatLastOrderUseCase } from '@/modules/order/application/use-cases/RepeatLastOrder.use-case'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import type {
  ConversationHandlerContext,
  GlobalConversationHandlerInterface,
} from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import { sendCartSummary } from '@/modules/conversation/application/handlers/support/CartSummary'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { GLOBAL_TRIGGER, MENU_BUTTON_ID, MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { CHANNEL } from '@/modules/shared/shared.constant'
import { OrderNoPreviousOrderError } from '@/shared/errors/OrderErrors'

export type GlobalHandlerDependencies = {
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
  readonly cartRepository: CartRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
  readonly repeatLastOrderUseCase: RepeatLastOrderUseCase
}

export class GlobalHandler implements GlobalConversationHandlerInterface {
  constructor(private readonly dependencies: GlobalHandlerDependencies) {}

  async tryHandle(context: ConversationHandlerContext): Promise<boolean> {
    const { session, customer, message } = context

    if (message.kind === 'text' && this.isExitWord(message.body)) {
      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.GREETING,
        context: {},
      })
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.GOODBYE)
      return true
    }

    if (this.isRepeatOrderTrigger(message)) {
      await this.handleRepeatOrder(session.customerPhone, customer.id)
      return true
    }

    return false
  }

  private async handleRepeatOrder(customerPhone: string, customerId: string): Promise<void> {
    try {
      const result = await this.dependencies.repeatLastOrderUseCase.execute({ customerId, channel: CHANNEL.WHATSAPP })

      if (result.skippedItems.length > 0) {
        const skippedNames = result.skippedItems.map((item) => `• ${item.productName}`).join('\n')
        await this.dependencies.whatsAppSender.sendText(customerPhone, `${MESSAGES.REPEAT_ORDER_SKIPPED_PREFIX}\n${skippedNames}`)
      }

      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone,
        currentState: CONVERSATION_STATE.CART_REVIEW,
        context: {},
      })
      await this.dependencies.whatsAppSender.sendText(customerPhone, MESSAGES.REPEAT_ORDER_ADDED)
      await sendCartSummary({
        customerPhone,
        cartId: result.cart.id,
        cartRepository: this.dependencies.cartRepository,
        productRepository: this.dependencies.productRepository,
        whatsAppSender: this.dependencies.whatsAppSender,
      })
    } catch (error) {
      if (error instanceof OrderNoPreviousOrderError) {
        await this.dependencies.whatsAppSender.sendText(customerPhone, MESSAGES.REPEAT_ORDER_UNAVAILABLE)
        return
      }

      throw error
    }
  }

  private isExitWord(body: string): boolean {
    const normalized = body.trim().toLowerCase()
    return (GLOBAL_TRIGGER.EXIT_WORDS as readonly string[]).includes(normalized)
  }

  private isRepeatOrderTrigger(message: ConversationHandlerContext['message']): boolean {
    if (message.kind === 'button_reply') return message.buttonId === MENU_BUTTON_ID.REPEAT_ORDER
    if (message.kind === 'list_reply') return message.listId === MENU_BUTTON_ID.REPEAT_ORDER
    return false
  }
}
