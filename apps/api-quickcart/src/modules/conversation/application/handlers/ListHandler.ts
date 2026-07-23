/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Estado `awaiting_list` (spec §4): recebe a lista de compras em texto e a
 * encaminha para casamento contra o catálogo. Áudio é enfileirado na `sttQueue`
 * (Fase 6) — o worker transcreve e chama a rota interna de resume da conversa.
 */

import type { ParseShoppingListUseCase } from '@/modules/conversation/application/use-cases/ParseShoppingList.use-case'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import type { ConversationHandlerContext, ConversationHandlerInterface } from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import type { ProcessParsedListItems } from '@/modules/conversation/application/handlers/support/ProcessParsedListItems'
import type { JobQueue } from '@/modules/order/domain/JobQueue.interface'
import { LIST_IMPORT_SOURCE } from '@/modules/conversation/shared/ListImport.constant'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { CHANNEL } from '@/modules/shared/shared.constant'

export type ListHandlerDependencies = {
  readonly parseShoppingListUseCase: ParseShoppingListUseCase
  readonly processParsedListItems: ProcessParsedListItems
  readonly whatsAppSender: WhatsAppSender
  readonly sttQueue: JobQueue
}

export class ListHandler implements ConversationHandlerInterface {
  constructor(private readonly dependencies: ListHandlerDependencies) {}

  async handle({ session, customer, message }: ConversationHandlerContext): Promise<void> {
    if (message.kind === 'audio') {
      await this.dependencies.sttQueue.add('transcribe', { sessionId: session.id, mediaId: message.mediaId })
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.AUDIO_PROCESSING)
      return
    }

    if (message.kind !== 'text') {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.AWAITING_LIST_PROMPT)
      return
    }

    const parseResult = await this.dependencies.parseShoppingListUseCase.execute({ rawText: message.body })
    if (parseResult.items.length === 0) {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.LIST_EMPTY_RESULT)
      return
    }

    await this.dependencies.processParsedListItems.execute({
      session,
      customerId: customer.id,
      channel: CHANNEL.WHATSAPP,
      items: parseResult.items,
      rawText: message.body,
      source: LIST_IMPORT_SOURCE.TEXT,
    })
  }
}
