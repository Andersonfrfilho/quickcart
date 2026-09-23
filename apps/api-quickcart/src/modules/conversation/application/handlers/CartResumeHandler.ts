/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Estado `awaiting_cart_resume_decision`: o cliente voltou depois da sessão expirada e escolhe entre
 * continuar a compra que tinha começado ou abrir outra.
 *
 * A pergunta é feita uma vez, na volta, e não a cada mensagem: o preço de errar aqui é alto nos dois
 * sentidos — descartar em silêncio apaga uma lista que a pessoa levou dez minutos montando, e somar em
 * silêncio entrega no balcão uma compra que ninguém pediu.
 */

import type { StartNewCartUseCase } from '@/modules/cart/application/use-cases/StartNewCart.use-case'
import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import type {
  ConversationHandlerContext,
  ConversationHandlerInterface,
} from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import { sendCartSummary } from '@/modules/conversation/application/handlers/support/CartSummary'
import { buildCartResumeQuestion } from '@/modules/conversation/application/handlers/support/cartResumeQuestion'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { CART_RESUME_BUTTON_ID, CART_RESUME_BUTTONS, MENU_BUTTONS, MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { CHANNEL } from '@/modules/shared/shared.constant'

export type CartResumeHandlerDependencies = {
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
  readonly cartRepository: CartRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
  readonly startNewCartUseCase: StartNewCartUseCase
}

export class CartResumeHandler implements ConversationHandlerInterface {
  constructor(private readonly dependencies: CartResumeHandlerDependencies) {}

  async handle({ session, customer, message }: ConversationHandlerContext): Promise<void> {
    const { conversationSessionRepository, whatsAppSender, cartRepository, productRepository } = this.dependencies

    if (message.kind !== 'button_reply') {
      await this.resendQuestion(session.customerPhone, customer.id)
      return
    }

    if (message.buttonId === CART_RESUME_BUTTON_ID.START_OVER) {
      const { cart } = await this.dependencies.startNewCartUseCase.execute({
        customerId: customer.id,
        channel: CHANNEL.WHATSAPP,
      })

      await conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.MAIN_MENU,
        context: {},
      })

      await whatsAppSender.sendText(
        session.customerPhone,
        MESSAGES.CART_RESUME_STARTED_OVER.replace('{codigo}', cart.shortCode),
      )
      await whatsAppSender.sendInteractiveButtons(session.customerPhone, MESSAGES.WELCOME, MENU_BUTTONS)
      return
    }

    if (message.buttonId !== CART_RESUME_BUTTON_ID.CONTINUE) {
      await this.resendQuestion(session.customerPhone, customer.id)
      return
    }

    const cart = await cartRepository.findOpenByCustomer(customer.id, CHANNEL.WHATSAPP)

    /*
     * O carrinho pode ter virado pedido em outra aba entre a pergunta e a resposta. Sem carrinho
     * aberto não há o que continuar, e o menu é a resposta honesta.
     */
    if (!cart) {
      await conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.MAIN_MENU,
        context: {},
      })
      await whatsAppSender.sendInteractiveButtons(session.customerPhone, MESSAGES.WELCOME, MENU_BUTTONS)
      return
    }

    await conversationSessionRepository.updateStateByPhone({
      customerPhone: session.customerPhone,
      currentState: CONVERSATION_STATE.CART_REVIEW,
      context: {},
    })

    await whatsAppSender.sendText(
      session.customerPhone,
      MESSAGES.CART_RESUME_CONTINUED.replace('{codigo}', cart.shortCode),
    )
    await sendCartSummary({
      customerPhone: session.customerPhone,
      cartId: cart.id,
      cartRepository,
      productRepository,
      whatsAppSender,
    })
  }

  /**
   * Repete a pergunta quando a resposta não foi um dos botões — sem sair do estado.
   *
   * A exceção é não haver mais o que retomar: aí insistir na pergunta prenderia a conversa num estado
   * cuja única saída é um botão que não faz mais sentido, e o menu é a saída.
   */
  private async resendQuestion(customerPhone: string, customerId: string): Promise<void> {
    const { cartRepository, whatsAppSender, conversationSessionRepository } = this.dependencies
    const question = await buildCartResumeQuestion({ customerId, cartRepository })

    if (!question) {
      await conversationSessionRepository.updateStateByPhone({
        customerPhone,
        currentState: CONVERSATION_STATE.MAIN_MENU,
        context: {},
      })
      await whatsAppSender.sendInteractiveButtons(customerPhone, MESSAGES.WELCOME, MENU_BUTTONS)
      return
    }

    await whatsAppSender.sendInteractiveButtons(customerPhone, question.bodyText, CART_RESUME_BUTTONS)
  }
}
