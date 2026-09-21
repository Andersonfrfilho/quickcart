/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cobra UMA vez a resposta que não veio, e só isso.
 *
 * Uma cobrança e não um lembrete recorrente: quem não respondeu em duas horas provavelmente não vai
 * responder, e insistir vira o assistente que fica batendo no ombro do cliente. Depois desta, a espera é
 * problema da loja — que vê o pedido parado na lista com a hora da pergunta e decide se liga.
 */

import type { OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import {
  buildCustomerDecisionMessage,
  type AskCustomerDecision,
} from '@/modules/order/shared/customerDecisionMessage'
import { ORDER_STATUS } from '@/modules/order/shared/Order.constant'
import { logger } from '@/shared/logger'

const useCaseLog = logger.child('RemindCustomerDecision')

export const REMIND_CUSTOMER_DECISION_OUTCOME = {
  SENT: 'sent',
  /** O pedido andou: o cliente respondeu, ou a loja resolveu sozinha. Nada a cobrar. */
  NOT_AWAITING: 'not_awaiting',
  /** Já foi cobrado. Segunda passagem do mesmo job (retry da fila) não vira segunda mensagem. */
  ALREADY_REMINDED: 'already_reminded',
  NOT_FOUND: 'not_found',
} as const

export type RemindCustomerDecisionOutcome =
  (typeof REMIND_CUSTOMER_DECISION_OUTCOME)[keyof typeof REMIND_CUSTOMER_DECISION_OUTCOME]

type RemindCustomerDecisionDependencies = {
  readonly orderRepository: OrderRepositoryInterface
  readonly askCustomer: AskCustomerDecision
}

export class RemindCustomerDecisionUseCase {
  constructor(private readonly dependencies: RemindCustomerDecisionDependencies) {}

  async execute(params: {
    readonly orderId: string
  }): Promise<{ readonly outcome: RemindCustomerDecisionOutcome }> {
    const detail = await this.dependencies.orderRepository.findDetailById(params.orderId)
    if (!detail) return { outcome: REMIND_CUSTOMER_DECISION_OUTCOME.NOT_FOUND }

    if (detail.order.status !== ORDER_STATUS.AWAITING_CUSTOMER_DECISION) {
      return { outcome: REMIND_CUSTOMER_DECISION_OUTCOME.NOT_AWAITING }
    }
    if (detail.order.customerDecisionRemindedAt !== null) {
      return { outcome: REMIND_CUSTOMER_DECISION_OUTCOME.ALREADY_REMINDED }
    }

    /**
     * Carimba ANTES de enviar — o inverso do aviso original, de propósito.
     *
     * Lá o risco era o cliente ficar sem saber da falta; aqui ele já sabe, e o risco que sobra é a fila
     * repetir o job (retry, dois workers) e cobrar duas ou três vezes a mesma pessoa. O carimbo condicional
     * é o que fecha essa porta: só um dos concorrentes casa o `WHERE`, e os outros saem sem enviar nada.
     */
    const stamped = await this.dependencies.orderRepository.markCustomerDecisionReminded(params.orderId)
    if (!stamped) return { outcome: REMIND_CUSTOMER_DECISION_OUTCOME.ALREADY_REMINDED }

    /** Todos os itens em falta, não só os "não avisados": esta é a mesma pergunta de novo, inteira. */
    const unavailableItems = detail.items.filter((item) => item.unavailableAt !== null)
    const message = buildCustomerDecisionMessage({ detail, unavailableItems })

    await this.dependencies.askCustomer({
      whatsappNumber: detail.order.customerPhone,
      body: `${MESSAGES.ORDER_DECISION_REMINDER_PREFIX}${message.body}`,
      buttons: message.buttons,
    })

    useCaseLog.info('customer_decision_reminded', { orderId: params.orderId })
    return { outcome: REMIND_CUSTOMER_DECISION_OUTCOME.SENT }
  }
}
