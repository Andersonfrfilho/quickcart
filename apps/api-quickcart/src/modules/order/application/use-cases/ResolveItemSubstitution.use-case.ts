/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A resposta do cliente sobre UM item em falta: trocar pelo parecido, ou seguir sem ele (ADR 0003).
 *
 * O que este use case NÃO faz é mover o pedido: trocar um item não resolve o pedido, resolve o item. Só
 * quando não sobra item a perguntar é que a pergunta do pedido inteiro sai — e é ela, respondida, que
 * devolve a sacola para a separação. Encerrar aqui pularia a confirmação do total que o cliente aprovou.
 */

import { OrderItemNotSubstitutableError } from '@/shared/errors/OrderErrors'
import type { OrderDetail, OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import { ORDER_STATUS } from '@/modules/order/shared/Order.constant'
import { logger } from '@/shared/logger'
import type { AskUnavailableItemsUseCase } from './AskUnavailableItems.use-case'
import {
  CUSTOMER_DECISION_SKIP_REASON,
  type CustomerDecisionSkipReason,
} from './ResolveCustomerDecision.use-case'

const useCaseLog = logger.child('ResolveItemSubstitution')

/**
 * O que o cliente precisa ler depois do toque.
 *
 * `substituted` traz o nome do que entrou e o total novo; `skipped` e `substitute_gone` dizem que a sacola
 * segue sem o item — a diferença entre os dois é quem decidiu, e isso muda o texto, não o desfecho.
 */
export type ResolveItemSubstitutionResult =
  | {
      readonly applied: true
      readonly outcome: 'substituted'
      readonly substituteName: string
      readonly detail: OrderDetail
    }
  | { readonly applied: true; readonly outcome: 'skipped' | 'substitute_gone'; readonly detail: OrderDetail }
  | { readonly applied: false; readonly reason: CustomerDecisionSkipReason }

type ResolveItemSubstitutionDependencies = {
  readonly orderRepository: OrderRepositoryInterface
  readonly askUnavailableItemsUseCase: AskUnavailableItemsUseCase
}

export class ResolveItemSubstitutionUseCase {
  constructor(private readonly dependencies: ResolveItemSubstitutionDependencies) {}

  async execute(params: {
    readonly orderId: string
    /** Quem tocou o botão, vindo da conversa autenticada pelo número — nunca do payload. */
    readonly customerId: string
    readonly orderItemId: string
    /** Ausente quando o cliente recusou: sem produto de destino não há troca a tentar. */
    readonly substituteProductId?: string | undefined
  }): Promise<ResolveItemSubstitutionResult> {
    const order = await this.dependencies.orderRepository.findById(params.orderId)
    if (!order) return { applied: false, reason: CUSTOMER_DECISION_SKIP_REASON.NOT_FOUND }

    // Mesma razão do `ResolveCustomerDecision`: o id trafega pelo aparelho do cliente, então é entrada de fora.
    if (order.customerId !== params.customerId) {
      useCaseLog.warn('item_substitution_owner_mismatch', { orderId: params.orderId })
      return { applied: false, reason: CUSTOMER_DECISION_SKIP_REASON.NOT_OWNER }
    }

    // A conversa de ontem continua no aparelho, e o botão de ontem ainda é tocável hoje.
    if (order.status !== ORDER_STATUS.AWAITING_CUSTOMER_DECISION) {
      return { applied: false, reason: CUSTOMER_DECISION_SKIP_REASON.NOT_AWAITING }
    }

    const outcome = params.substituteProductId
      ? await this.trySubstitute({
          orderId: params.orderId,
          orderItemId: params.orderItemId,
          productId: params.substituteProductId,
        })
      : await this.skipItem({ orderId: params.orderId, orderItemId: params.orderItemId })

    if (!outcome.applied) return outcome

    /*
     * Pergunta o próximo item ANTES de responder ao cliente é o que a ordem das chamadas evita: quem chama
     * manda primeiro a confirmação desta resposta, e só então a próxima pergunta sai daqui. Duas mensagens,
     * na ordem em que a conversa faz sentido.
     */
    await this.dependencies.askUnavailableItemsUseCase.execute({ detail: outcome.detail })

    return outcome
  }

  private async trySubstitute(params: {
    readonly orderId: string
    readonly orderItemId: string
    readonly productId: string
  }): Promise<ResolveItemSubstitutionResult> {
    const result = await this.dependencies.orderRepository.substituteItem(params)

    if (!result.ok) {
      /*
       * `out_of_stock` não é falha: entre a oferta e o toque passam minutos, e o substituto pode ter sido
       * separado para outro pedido. O desfecho vira "seguimos sem o item" — que é onde o cliente já estaria
       * se tivesse recusado.
       */
      if (result.reason === 'out_of_stock') {
        const skipped = await this.skipItem({ orderId: params.orderId, orderItemId: params.orderItemId })
        // Mesmo desfecho, texto diferente: quem aceitou a troca precisa saber por que ela não valeu.
        return skipped.applied ? { ...skipped, outcome: 'substitute_gone' } : skipped
      }

      /*
       * `not_substitutable` é o item que não está em falta, não é deste pedido, ou já foi trocado. Nenhum
       * dos três é estado do sistema para corrigir aqui: é resposta a uma pergunta que já foi respondida.
       */
      throw new OrderItemNotSubstitutableError({ orderId: params.orderId, orderItemId: params.orderItemId })
    }

    const substitute = result.detail.items.find((item) => item.substitutesOrderItemId === params.orderItemId)

    return {
      applied: true,
      outcome: 'substituted',
      // A linha acabou de ser inserida na mesma transação; sem ela não haveria `ok: true`.
      substituteName: substitute?.productName ?? '',
      detail: result.detail,
    }
  }

  /**
   * Seguir sem o item é só carimbar a falta como respondida: a linha já está marcada e já saiu da conta.
   *
   * Nada de novo a escrever é o ponto — recusar a troca devolve exatamente o pedido que a falta produziu.
   */
  private async skipItem(params: {
    readonly orderId: string
    readonly orderItemId: string
  }): Promise<ResolveItemSubstitutionResult> {
    await this.dependencies.orderRepository.markItemUnavailableNotified({
      orderId: params.orderId,
      itemId: params.orderItemId,
    })

    const detail = await this.dependencies.orderRepository.findDetailById(params.orderId)
    if (!detail) return { applied: false, reason: CUSTOMER_DECISION_SKIP_REASON.NOT_FOUND }

    return { applied: true, outcome: 'skipped', detail }
  }
}
