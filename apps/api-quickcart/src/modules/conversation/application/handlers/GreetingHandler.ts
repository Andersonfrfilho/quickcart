/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Estado `greeting` (spec §4): qualquer mensagem recebida aqui dispara as
 * boas-vindas + menu de botões, ignorando o conteúdo em si — o cliente ainda
 * não escolheu um caminho. `context.wasExpired`, setado pelo ConversationEngine
 * ao expirar a sessão, é consumido aqui e depois limpo.
 *
 * Sessão expirada COM carrinho de itens não vai direto para o menu: antes, pergunta se o cliente quer
 * continuar aquela compra ou começar outra. O carrinho é por cliente, não por conversa — sem a
 * pergunta, a lista da conversa anterior continuava crescendo em silêncio na conversa seguinte.
 */

import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import type { ConversationHandlerContext, ConversationHandlerInterface } from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { buildCartResumeQuestion } from '@/modules/conversation/application/handlers/support/cartResumeQuestion'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { CART_RESUME_BUTTONS, MENU_BUTTONS, MESSAGES } from '@/modules/conversation/shared/Messages.constant'

export type GreetingHandlerDependencies = {
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
  readonly cartRepository: Pick<CartRepositoryInterface, 'findOpenByCustomer' | 'listItems'>
}

export class GreetingHandler implements ConversationHandlerInterface {
  constructor(private readonly dependencies: GreetingHandlerDependencies) {}

  async handle({ session, customer }: ConversationHandlerContext): Promise<void> {
    const context = (session.context ?? {}) as ConversationContext

    if (context.wasExpired) {
      const question = await buildCartResumeQuestion({
        customerId: customer.id,
        cartRepository: this.dependencies.cartRepository,
      })

      if (question) {
        await this.dependencies.conversationSessionRepository.updateStateByPhone({
          customerPhone: session.customerPhone,
          currentState: CONVERSATION_STATE.AWAITING_CART_RESUME_DECISION,
          context: {},
        })

        await this.dependencies.whatsAppSender.sendInteractiveButtons(
          session.customerPhone,
          question.bodyText,
          CART_RESUME_BUTTONS,
        )
        return
      }
    }

    const bodyText = context.wasExpired ? `${MESSAGES.SESSION_EXPIRED_PREFIX}${MESSAGES.WELCOME}` : MESSAGES.WELCOME

    await this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone: session.customerPhone,
      currentState: CONVERSATION_STATE.MAIN_MENU,
      context: {},
    })

    await this.dependencies.whatsAppSender.sendInteractiveButtons(session.customerPhone, bodyText, MENU_BUTTONS)
  }
}
