/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Estado `main_menu` (spec §4): trata os 3 botões do menu e, como atalho,
 * aceita a lista de compras já mandada direto por texto (2+ itens parseados)
 * sem exigir que o cliente toque em "Enviar lista" primeiro.
 */

import type { CategoryRepositoryInterface } from '@/modules/catalog/domain/CategoryRepository.interface'
import type { Customer } from '@/infra/database/schema'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { ParseShoppingListUseCase } from '@/modules/conversation/application/use-cases/ParseShoppingList.use-case'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import type { ConversationHandlerContext, ConversationHandlerInterface } from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import type { ProcessParsedListItems } from '@/modules/conversation/application/handlers/support/ProcessParsedListItems'
import { sendCategoryList } from './support/sendCategoryList'
import { buildCategorySection } from '@/modules/conversation/application/handlers/support/InteractiveListBuilders'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { LIST_IMPORT_SOURCE } from '@/modules/conversation/shared/ListImport.constant'
import { MENU_BUTTON_ID, MENU_BUTTONS, MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { CHANNEL } from '@/modules/shared/shared.constant'

const FREE_TEXT_LIST_MIN_ITEMS = 2

export type MenuHandlerDependencies = {
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
  readonly categoryRepository: CategoryRepositoryInterface
  readonly parseShoppingListUseCase: ParseShoppingListUseCase
  readonly processParsedListItems: ProcessParsedListItems
}

export class MenuHandler implements ConversationHandlerInterface {
  constructor(private readonly dependencies: MenuHandlerDependencies) {}

  async handle({ session, customer, message }: ConversationHandlerContext): Promise<void> {
    if (message.kind === 'button_reply') {
      await this.handleButtonReply(session, message.buttonId)
      return
    }

    if (message.kind === 'text') {
      await this.handleFreeText(session, customer, message.body)
      return
    }

    await this.sendMenuHint(session)
  }

  private async handleButtonReply(session: ConversationSession, buttonId: string): Promise<void> {
    if (buttonId === MENU_BUTTON_ID.SEND_LIST) {
      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.AWAITING_LIST,
        context: (session.context ?? {}) as Record<string, unknown>,
      })
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.AWAITING_LIST_PROMPT)
      return
    }

    if (buttonId === MENU_BUTTON_ID.BROWSE) {
      await this.enterBrowsingCategories(session)
      return
    }

    await this.sendMenuHint(session)
  }

  private async handleFreeText(session: ConversationSession, customer: Customer, rawText: string): Promise<void> {
    const parseResult = await this.dependencies.parseShoppingListUseCase.execute({ rawText })
    if (parseResult.items.length < FREE_TEXT_LIST_MIN_ITEMS) {
      await this.sendMenuHint(session)
      return
    }

    await this.dependencies.processParsedListItems.execute({
      session,
      customerId: customer.id,
      channel: CHANNEL.WHATSAPP,
      items: parseResult.items,
      rawText,
      source: LIST_IMPORT_SOURCE.TEXT,
    })
  }

  private async enterBrowsingCategories(session: ConversationSession): Promise<void> {
    // Sem categoria não há estado de navegação a assumir: a pessoa recebe o aviso e continua onde
    // estava, em vez de ficar num estado que não tem como avançar.
    const sent = await sendCategoryList({
      categoryRepository: this.dependencies.categoryRepository,
      whatsAppSender: this.dependencies.whatsAppSender,
      customerPhone: session.customerPhone,
    })
    if (!sent) return

    await this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone: session.customerPhone,
      currentState: CONVERSATION_STATE.BROWSING_CATEGORIES,
      context: {},
    })
  }

  private async sendMenuHint(session: ConversationSession): Promise<void> {
    await this.dependencies.whatsAppSender.sendInteractiveButtons(session.customerPhone, MESSAGES.MENU_HINT, MENU_BUTTONS)
  }
}
