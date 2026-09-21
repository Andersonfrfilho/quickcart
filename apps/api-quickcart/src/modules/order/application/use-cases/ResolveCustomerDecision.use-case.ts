/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O toque do cliente no botão da pergunta "faltou item, e agora?".
 *
 * Tudo passa pelo `UpdateOrderStatusUseCase` em vez de escrever o status direto: é lá que moram a
 * validação da esteira, a devolução de estoque no cancelamento e o aviso de mudança de status. Um atalho
 * aqui teria que reimplementar os três, e a segunda implementação é a que erra.
 */

import { OrderInvalidStatusTransitionError } from '@/shared/errors/OrderErrors'
import type { OrderRepositoryInterface, OrderRecord } from '@/modules/order/domain/OrderRepository.interface'
import { ORDER_DECISION, type OrderDecision } from '@/modules/conversation/shared/orderDecisionButton'
import { ORDER_STATUS } from '@/modules/order/shared/Order.constant'
import type { UpdateOrderStatusUseCase } from './UpdateOrderStatus.use-case'
import { logger } from '@/shared/logger'

const useCaseLog = logger.child('ResolveCustomerDecision')

/**
 * Por que a resposta não foi aplicada. Não é erro: são situações normais de uma pergunta que ficou aberta.
 *
 * `not_owner` é a que não pode virar mensagem detalhada ao cliente — dizer "esse pedido não é seu" já
 * confirma que o pedido existe para quem digitou um id alheio.
 */
export const CUSTOMER_DECISION_SKIP_REASON = {
  NOT_FOUND: 'not_found',
  NOT_OWNER: 'not_owner',
  NOT_AWAITING: 'not_awaiting',
} as const

export type CustomerDecisionSkipReason =
  (typeof CUSTOMER_DECISION_SKIP_REASON)[keyof typeof CUSTOMER_DECISION_SKIP_REASON]

export type ResolveCustomerDecisionResult =
  | { readonly applied: true; readonly order: OrderRecord; readonly decision: OrderDecision }
  | { readonly applied: false; readonly reason: CustomerDecisionSkipReason }

type ResolveCustomerDecisionDependencies = {
  readonly orderRepository: OrderRepositoryInterface
  readonly updateOrderStatusUseCase: UpdateOrderStatusUseCase
}

export class ResolveCustomerDecisionUseCase {
  constructor(private readonly dependencies: ResolveCustomerDecisionDependencies) {}

  async execute(params: {
    readonly orderId: string
    /** Quem tocou o botão, vindo da conversa autenticada pelo número — nunca do payload. */
    readonly customerId: string
    readonly decision: OrderDecision
  }): Promise<ResolveCustomerDecisionResult> {
    const order = await this.dependencies.orderRepository.findById(params.orderId)
    if (!order) return { applied: false, reason: CUSTOMER_DECISION_SKIP_REASON.NOT_FOUND }

    /**
     * O pedido tem que ser de quem respondeu.
     *
     * O id vem dentro do id do botão, que trafega pelo aparelho do cliente — e um id de pedido que chega
     * de fora é entrada não confiável, mesmo tendo saído daqui. Sem esta linha, um payload forjado
     * cancelaria pedido de outra pessoa (BOLA).
     */
    if (order.customerId !== params.customerId) {
      useCaseLog.warn('customer_decision_owner_mismatch', { orderId: params.orderId })
      return { applied: false, reason: CUSTOMER_DECISION_SKIP_REASON.NOT_OWNER }
    }

    /**
     * Só vale enquanto a pergunta está de pé.
     *
     * A conversa antiga continua no aparelho do cliente: o botão de ontem ainda é tocável hoje, e sem esta
     * checagem ele cancelaria um pedido que a loja já resolveu e talvez já entregou.
     */
    if (order.status !== ORDER_STATUS.AWAITING_CUSTOMER_DECISION) {
      return { applied: false, reason: CUSTOMER_DECISION_SKIP_REASON.NOT_AWAITING }
    }

    /**
     * Volta para `preparing`, e não para `separated`: sem um item, a sacola precisa ser revisitada de
     * qualquer jeito, e afirmar "separado" seria afirmar uma conferência que não aconteceu.
     */
    const nextStatus =
      params.decision === ORDER_DECISION.CONTINUE ? ORDER_STATUS.PREPARING : ORDER_STATUS.CANCELLED

    try {
      const { order: updated } = await this.dependencies.updateOrderStatusUseCase.execute({
        orderId: params.orderId,
        status: nextStatus,
      })
      return { applied: true, order: updated, decision: params.decision }
    } catch (error: unknown) {
      /**
       * Catch estreito de propósito (regra 7): só a corrida em que a loja mudou o pedido entre a leitura
       * acima e a gravação. Para o cliente isso não é falha, é "já foi resolvido" — qualquer outro erro
       * continua subindo para o filtro global.
       */
      if (error instanceof OrderInvalidStatusTransitionError) {
        return { applied: false, reason: CUSTOMER_DECISION_SKIP_REASON.NOT_AWAITING }
      }
      throw error
    }
  }
}
