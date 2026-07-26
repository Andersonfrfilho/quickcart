/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * As ações que o grafo pode invocar. Cada uma entrega a conversa a um estado da engine TS: o
 * grafo decide QUANDO entrar em "montar lista", "navegar catálogo" ou "repetir pedido", e o
 * código existente cuida do COMO — matching por LLM, aritmética de carrinho, estoque.
 *
 * Depois que uma ação entrega o controle, o grafo termina (o FlowDriver solta a posição) e as
 * próximas mensagens vão para a engine, até ela devolver a conversa ao menu.
 */

import type { FlowActionHandler } from '@adatechnology/meta-whatsapp-contracts'
import type { SessionRepository } from '@adatechnology/meta-whatsapp-module'
import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import type { RepeatLastOrderUseCase } from '@/modules/order/application/use-cases/RepeatLastOrder.use-case'
import type { CustomerRepositoryInterface } from '@/modules/webhook/domain/CustomerRepository.interface'
import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import { sendCartSummary } from '@/modules/conversation/application/handlers/support/CartSummary'
import { OrderNoPreviousOrderError } from '@/shared/errors/OrderErrors'
import { CHANNEL } from '@/modules/shared/shared.constant'

const actionLog = logger.child('FlowAction')
const COMPANY_ID = environment.WHATSAPP_COMPANY_ID

// Nomes que o lojista escolhe no editor ao criar um nó de ação. São contrato com a UI: mudar
// um destes quebra os grafos já desenhados, então entram como constante e não como literal.
export const QUICKCART_FLOW_ACTION = {
  START_LIST: 'quickcart_start_list',
  BROWSE_CATALOG: 'quickcart_browse_catalog',
  REPEAT_ORDER: 'quickcart_repeat_order',
} as const

export type RegisterQuickCartFlowActionsParams = {
  readonly registerFlowAction: (kind: string, handler: FlowActionHandler) => void
  readonly sessionRepository: SessionRepository
  readonly whatsAppSender: WhatsAppSender
  readonly customerRepository: CustomerRepositoryInterface
  readonly repeatLastOrderUseCase: RepeatLastOrderUseCase
  readonly cartRepository: CartRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
}

export function registerQuickCartFlowActions(params: RegisterQuickCartFlowActionsParams): void {
  const {
    registerFlowAction,
    sessionRepository,
    whatsAppSender,
    customerRepository,
    repeatLastOrderUseCase,
    cartRepository,
    productRepository,
  } = params

  // Entrega a conversa a um estado da engine TS. O contexto do grafo é preservado: o cliente
  // pode ter respondido coisas antes de chegar aqui, e a engine lê o mesmo `context`.
  async function handOver(whatsappNumber: string, state: string, context: Record<string, unknown>): Promise<void> {
    await sessionRepository.setState(COMPANY_ID, whatsappNumber, state, context)
    actionLog.info('handed_over_to_engine', { state })
  }

  registerFlowAction(QUICKCART_FLOW_ACTION.START_LIST, async ({ session, context }) => {
    await handOver(session.whatsappNumber, CONVERSATION_STATE.AWAITING_LIST, context)
    await whatsAppSender.sendText(session.whatsappNumber, MESSAGES.AWAITING_LIST_PROMPT)
  })

  registerFlowAction(QUICKCART_FLOW_ACTION.BROWSE_CATALOG, async ({ session, context }) => {
    // Só posiciona o estado e devolve: quem monta a lista de categorias é o BrowseHandler, na
    // próxima mensagem. Duplicar essa montagem aqui criaria duas fontes para a mesma tela.
    await handOver(session.whatsappNumber, CONVERSATION_STATE.BROWSING_CATEGORIES, context)
    await whatsAppSender.sendText(session.whatsappNumber, MESSAGES.MENU_HINT)
  })

  // Espelha o caminho do GlobalHandler para "repetir pedido": mesmas mensagens, mesmo resumo
  // de carrinho, mesmo estado final. Divergir aqui daria ao cliente duas experiências
  // diferentes para a mesma intenção, dependendo de ele ter tocado no botão ou digitado.
  registerFlowAction(QUICKCART_FLOW_ACTION.REPEAT_ORDER, async ({ session, context }) => {
    const customer = await customerRepository.findByPhone(session.whatsappNumber)
    if (!customer) {
      await whatsAppSender.sendText(session.whatsappNumber, MESSAGES.REPEAT_ORDER_UNAVAILABLE)
      return
    }

    try {
      const result = await repeatLastOrderUseCase.execute({ customerId: customer.id, channel: CHANNEL.WHATSAPP })

      if (result.skippedItems.length > 0) {
        const skippedNames = result.skippedItems.map((item) => `• ${item.productName}`).join('\n')
        await whatsAppSender.sendText(session.whatsappNumber, `${MESSAGES.REPEAT_ORDER_SKIPPED_PREFIX}\n${skippedNames}`)
      }

      await handOver(session.whatsappNumber, CONVERSATION_STATE.CART_REVIEW, context)
      await whatsAppSender.sendText(session.whatsappNumber, MESSAGES.REPEAT_ORDER_ADDED)
      await sendCartSummary({
        customerPhone: session.whatsappNumber,
        cartId: result.cart.id,
        cartRepository,
        productRepository,
        whatsAppSender,
      })
    } catch (error) {
      if (error instanceof OrderNoPreviousOrderError) {
        await whatsAppSender.sendText(session.whatsappNumber, MESSAGES.REPEAT_ORDER_UNAVAILABLE)
        return
      }
      throw error
    }
  })
}
