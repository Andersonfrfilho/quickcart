/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O cliente desistindo da compra pelo WhatsApp, fora do desvio de item em falta.
 *
 * Passa pelo `UpdateOrderStatusUseCase` como todo o resto: é lá que moram a esteira, a devolução de
 * estoque e o aviso. O que este use case acrescenta é achar DE QUAL pedido se trata — o cliente diz
 * "quero cancelar o pedido", não o id — e traduzir a recusa da esteira em algo que vira frase.
 */

import { ORDER_ACTOR, canTransitionTo } from '@/modules/order/domain/orderStatusFlow'
import type { OrderRecord, OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import { ORDER_STATUS } from '@/modules/order/shared/Order.constant'
import { OrderInvalidStatusTransitionError } from '@/shared/errors/OrderErrors'

import type { UpdateOrderStatusUseCase } from './UpdateOrderStatus.use-case'

/**
 * Por que o cancelamento não aconteceu. Nenhum é erro: são as respostas honestas a quem pediu.
 *
 * `too_late` existe separado de `nothing_to_cancel` porque as duas viram frases diferentes — uma
 * explica que a sacola já saiu e oferece a loja, a outra diz que não há pedido aberto.
 */
export const CUSTOMER_CANCEL_SKIP_REASON = {
  NOTHING_TO_CANCEL: 'nothing_to_cancel',
  TOO_LATE: 'too_late',
  /** Só aparece em `dryRun`: daria para cancelar, e nada foi gravado. */
  WOULD_CANCEL: 'would_cancel',
} as const

export type CustomerCancelSkipReason =
  (typeof CUSTOMER_CANCEL_SKIP_REASON)[keyof typeof CUSTOMER_CANCEL_SKIP_REASON]

export type CancelOrderByCustomerResult =
  | { readonly cancelled: true; readonly order: OrderRecord }
  | { readonly cancelled: false; readonly reason: CustomerCancelSkipReason; readonly order?: OrderRecord }

type CancelOrderByCustomerDependencies = {
  readonly orderRepository: Pick<OrderRepositoryInterface, 'findLastByCustomer' | 'findById'>
  readonly updateOrderStatusUseCase: Pick<UpdateOrderStatusUseCase, 'execute'>
}

/** Pedido que já acabou não é candidato: cancelar o que foi entregue ontem não é desistir de nada. */
const CLOSED_STATUSES: readonly string[] = [
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELLED,
]

export type CancelOrderByCustomerParams = {
  readonly customerId: string
  /**
   * Preenchido quando a confirmação veio pelo botão, que carrega o id do pedido perguntado.
   *
   * Sem ele, o alvo é o último pedido do cliente. Com ele, o alvo é aquele — entre a pergunta e o
   * toque o cliente pode ter feito outra compra, e cancelar a compra nova porque ela virou "a
   * última" seria cancelar o que ninguém pediu.
   */
  readonly orderId?: string
  /**
   * Só responde se daria, sem gravar nada. É o que a pergunta de confirmação precisa saber.
   *
   * Existe aqui e não como uma segunda leitura no handler porque a regra de quem pode cancelar é
   * desta camada: duplicá-la lá deixaria a pergunta e a execução discordando no dia em que a regra
   * mudasse — e a discordância seria perguntar "quer cancelar?" para depois dizer que não dá.
   */
  readonly dryRun?: boolean
}

export class CancelOrderByCustomerUseCase {
  constructor(private readonly dependencies: CancelOrderByCustomerDependencies) {}

  async execute(params: CancelOrderByCustomerParams): Promise<CancelOrderByCustomerResult> {
    const order = params.orderId
      ? await this.dependencies.orderRepository.findById(params.orderId)
      : await this.dependencies.orderRepository.findLastByCustomer(params.customerId)

    if (!order || CLOSED_STATUSES.includes(order.status)) {
      return { cancelled: false, reason: CUSTOMER_CANCEL_SKIP_REASON.NOTHING_TO_CANCEL }
    }

    /**
     * O pedido tem que ser de quem pediu.
     *
     * Vale mesmo com o id vindo de um botão que saiu daqui: ele trafega pelo aparelho do cliente, e
     * um payload forjado cancelaria pedido alheio (BOLA).
     */
    if (order.customerId !== params.customerId) {
      return { cancelled: false, reason: CUSTOMER_CANCEL_SKIP_REASON.NOTHING_TO_CANCEL }
    }

    const allowed = canTransitionTo({
      status: order.status,
      deliveryType: order.deliveryType,
      deliveryFailureReason: order.deliveryFailureReason,
      actor: ORDER_ACTOR.CUSTOMER,
      nextStatus: ORDER_STATUS.CANCELLED,
    })
    if (!allowed) return { cancelled: false, reason: CUSTOMER_CANCEL_SKIP_REASON.TOO_LATE, order }

    // Daria: quem só perguntou para aqui, com o pedido em mãos para a frase ser montada.
    if (params.dryRun) return { cancelled: false, reason: CUSTOMER_CANCEL_SKIP_REASON.WOULD_CANCEL, order }

    try {
      const { order: cancelled } = await this.dependencies.updateOrderStatusUseCase.execute({
        orderId: order.id,
        status: ORDER_STATUS.CANCELLED,
        actor: ORDER_ACTOR.CUSTOMER,
      })
      return { cancelled: true, order: cancelled }
    } catch (error: unknown) {
      /*
       * Catch estreito: só a corrida em que a loja moveu o pedido entre a leitura e a gravação —
       * separar a sacola no mesmo segundo em que o cliente toca o botão. Para ele isso é "tarde
       * demais", que é a verdade; qualquer outro erro continua subindo.
       */
      if (error instanceof OrderInvalidStatusTransitionError) {
        return { cancelled: false, reason: CUSTOMER_CANCEL_SKIP_REASON.TOO_LATE, order }
      }
      throw error
    }
  }
}
