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
 * do estado, em qualquer estado. Lista ditada entra aqui pelo mesmo motivo que "sair": é intenção do
 * cliente, não resposta ao estado — e o handler do estado, por definição, só entende resposta. `repeat_order` copia os itens do último pedido pra
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
  ConversationHandlerInterface,
  GlobalConversationHandlerInterface,
} from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import { looksLikeShoppingList } from '@/modules/conversation/application/looksLikeShoppingList'
import { sendCartSummary } from '@/modules/conversation/application/handlers/support/CartSummary'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { GLOBAL_TRIGGER, MENU_BUTTON_ID, MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { CHANNEL } from '@/modules/shared/shared.constant'
import { OrderNoPreviousOrderError } from '@/shared/errors/OrderErrors'

/**
 * Estados em que uma lista solta é atendida, e não recusada.
 *
 * É lista fechada, e não "todos menos alguns", porque o custo dos dois erros é diferente: deixar de
 * atender mantém o comportamento de hoje, enquanto atender no lugar errado interrompe o que a pessoa
 * estava fazendo. Fora daqui ficam os estados que coletam um dado específico — endereço tem vírgula e
 * número e seria lido como lista —, o que já espera lista (`awaiting_list`, que tem handler próprio) e
 * a desambiguação, onde a resposta é sobre o item anterior.
 *
 * `cart_review` está dentro de propósito: "adiciona mais dois quilos de arroz" no meio da revisão é
 * pedido comum, e carrinho é reversível — nenhum pedido foi fechado ainda.
 */
const SHOPPING_LIST_INTENT_STATES: ReadonlySet<string> = new Set([
  CONVERSATION_STATE.GREETING,
  CONVERSATION_STATE.MAIN_MENU,
  CONVERSATION_STATE.BROWSING_CATEGORIES,
  CONVERSATION_STATE.CART_REVIEW,
])

export type GlobalHandlerDependencies = {
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
  readonly cartRepository: CartRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
  readonly repeatLastOrderUseCase: RepeatLastOrderUseCase
  /**
   * Quem monta carrinho a partir de texto. É o MESMO handler do estado `awaiting_list`.
   *
   * Recebe o handler em vez de refazer parse e casamento aqui: duas implementações de "virar lista em
   * carrinho" dariam ao cliente dois resultados diferentes para a mesma frase, dependendo de o bot ter
   * pedido a lista ou de ele ter ditado por conta própria.
   */
  readonly listHandler: ConversationHandlerInterface
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

    if (message.kind === 'text' && this.shouldHandleAsShoppingList(session.currentState, message.body)) {
      // Avisa antes de agir: o bot está mudando de assunto por conta própria.
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.LIST_INTENT_DETECTED)
      await this.dependencies.listHandler.handle(context)
      return true
    }

    return false
  }

  /**
   * Nota de voz chega aqui já como texto (ver `resolveInboundAudio`), então ditar a compra e digitá-la
   * seguem o mesmo caminho — o cliente de supermercado que dita uma lista longa era exatamente quem
   * ouvia "escolha uma opção da lista acima".
   */
  private shouldHandleAsShoppingList(currentState: string, body: string): boolean {
    if (!SHOPPING_LIST_INTENT_STATES.has(currentState)) return false
    return looksLikeShoppingList(body)
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
