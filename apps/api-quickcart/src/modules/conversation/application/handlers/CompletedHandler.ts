/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Estado `completed`: a compra fechou e o pedido ainda está vivo.
 *
 * Antes deste handler o `confirmOrder` devolvia a sessão para `greeting`, e qualquer texto depois da
 * compra reabria o menu de boas-vindas. Foi assim que um "ok" — resposta à oferta de troca de um
 * item em falta — virou "quer fazer um pedido?" no meio de um pedido em separação.
 *
 * Quem está aqui quase sempre quer saber onde está o pedido, e a resposta é dada pela palavra que ele
 * usou. O que o reconhecimento por palavra não cobre não é chutado: cai nos botões, que não dependem
 * de palavra nenhuma.
 *
 * A saída é por leitura, não por evento: a cada mensagem o handler olha o último pedido e, quando ele
 * terminou, entrega a conversa ao `GreetingHandler`. Não existe job marcando "entregou", e por isso
 * também não existe sessão presa aqui quando o pedido acaba.
 */

import type { OrderRecord, OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import type { ConversationHandlerContext, ConversationHandlerInterface } from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { isAcknowledgement } from '@/modules/conversation/shared/isAcknowledgement'
import { isOrderStatusRequest } from '@/modules/conversation/shared/isOrderStatusRequest'
import { describeOrderSituation, isOrderStillRunning } from '@/modules/conversation/shared/orderSituation'
import {
  MESSAGES,
  ORDER_TRACKING_BUTTON_ID,
  ORDER_TRACKING_BUTTONS,
} from '@/modules/conversation/shared/Messages.constant'

export type CompletedHandlerDependencies = {
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
  readonly orderRepository: Pick<OrderRepositoryInterface, 'findLastByCustomer'>
  /**
   * Quem atende quando o pedido terminou e quando o cliente pede outro.
   *
   * É o MESMO handler do estado `greeting`, recebido em vez de reimplementado: "abrir o menu" escrito
   * duas vezes daria ao cliente dois menus diferentes dependendo de por onde ele chegou — e a pergunta
   * do carrinho aberto, que o `GreetingHandler` faz, desapareceria em um dos dois caminhos.
   */
  readonly greetingHandler: ConversationHandlerInterface
}

export class CompletedHandler implements ConversationHandlerInterface {
  constructor(private readonly dependencies: CompletedHandlerDependencies) {}

  async handle(context: ConversationHandlerContext): Promise<void> {
    const { session, customer, message } = context

    const order = await this.dependencies.orderRepository.findLastByCustomer(customer.id)
    if (!order || !isOrderStillRunning(order.status)) {
      await this.dependencies.greetingHandler.handle(context)
      return
    }

    if (message.kind === 'button_reply') {
      await this.handleButtonReply({ session, context, order, buttonId: message.buttonId })
      return
    }

    if (message.kind === 'text' && isAcknowledgement(message.body)) {
      await this.dependencies.whatsAppSender.sendText(
        session.customerPhone,
        MESSAGES.ORDER_TRACKING_ACKNOWLEDGED.replace('{codigo}', order.shortCode),
      )
      return
    }

    if (message.kind === 'text' && isOrderStatusRequest(message.body)) {
      await this.sendSituation({ session, order })
      return
    }

    /*
     * Não é agradecimento, não é pergunta de status e o GlobalHandler já descartou lista de compras,
     * saída, cancelamento e atendente: aqui o bot não sabe o que foi pedido, e a única resposta honesta
     * é dizer onde o pedido está e deixar os três caminhos à mão. Sempre o cartão, nunca a linha curta
     * — quem não foi entendido precisa dos botões, e é na repetição que ele mais precisa.
     */
    await this.sendTrackingCard({ session, order })
  }

  private async handleButtonReply(params: {
    readonly session: ConversationSession
    readonly context: ConversationHandlerContext
    readonly order: OrderRecord
    readonly buttonId: string
  }): Promise<void> {
    if (params.buttonId === ORDER_TRACKING_BUTTON_ID.NEW_ORDER) {
      await this.dependencies.greetingHandler.handle(params.context)
      return
    }

    /*
     * Tocar em "Acompanhar" é pedir o status de novo, de propósito — a linha curta basta, e o cartão
     * com os mesmos três botões logo abaixo deles seria a segunda cópia da mesma tela.
     */
    await this.sendSituationLine({ session: params.session, order: params.order })
  }

  /**
   * Cartão com botões na primeira vez e a cada mudança de situação; só a linha nas repetições.
   *
   * A pergunta de status é a que mais se repete no pós-compra, e três cartões idênticos seguidos é o
   * que faz o cliente concluir que o bot travou — ainda que a informação esteja certa nas três.
   */
  private async sendSituation(params: { readonly session: ConversationSession; readonly order: OrderRecord }): Promise<void> {
    const { session, order } = params
    const context = (session.context ?? {}) as ConversationContext

    if (context.trackedOrderStatus === order.status) {
      await this.sendSituationLine({ session, order })
      return
    }

    await this.sendTrackingCard({ session, order })
  }

  private async sendTrackingCard(params: { readonly session: ConversationSession; readonly order: OrderRecord }): Promise<void> {
    const { session, order } = params
    const context = (session.context ?? {}) as ConversationContext

    await this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone: session.customerPhone,
      currentState: session.currentState,
      context: { ...context, trackedOrderStatus: order.status },
    })

    await this.dependencies.whatsAppSender.sendInteractiveButtons(
      session.customerPhone,
      MESSAGES.ORDER_TRACKING_CARD.replace('{codigo}', order.shortCode).replace(
        '{situacao}',
        describeOrderSituation({ status: order.status, deliveryType: order.deliveryType }),
      ),
      ORDER_TRACKING_BUTTONS,
    )
  }

  private async sendSituationLine(params: { readonly session: ConversationSession; readonly order: OrderRecord }): Promise<void> {
    await this.dependencies.whatsAppSender.sendText(
      params.session.customerPhone,
      MESSAGES.ORDER_TRACKING_LINE.replace('{codigo}', params.order.shortCode).replace(
        '{situacao}',
        describeOrderSituation({ status: params.order.status, deliveryType: params.order.deliveryType }),
      ),
    )
  }
}
