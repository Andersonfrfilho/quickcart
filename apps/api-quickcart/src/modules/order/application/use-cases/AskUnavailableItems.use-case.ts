/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A pergunta que sai quando faltou item — a de troca, item a item, ou a do pedido inteiro (ADR 0003).
 *
 * Um lugar só porque as duas entradas fazem a mesma escolha: o aviso da loja ("faltou isso") e a resposta
 * do cliente a uma troca ("e o próximo item?") precisam decidir igual o que perguntar em seguida. Em dois
 * lugares, o segundo item de uma compra receberia a pergunta global enquanto o primeiro recebeu a de troca.
 *
 * A ordem é: existe parecido para o próximo item ainda não perguntado? Pergunta a troca. Não existe para
 * nenhum? Cai na pergunta de sempre, sobre o pedido inteiro. Nada a perguntar? Não manda nada.
 */

import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { OrderDetail, OrderItemRecord, OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import { buildCustomerDecisionMessage, type AskCustomerDecision } from '@/modules/order/shared/customerDecisionMessage'
import { buildItemSubstitutionMessage } from '@/modules/order/shared/itemSubstitutionMessage'
import { MAX_SUBSTITUTION_QUESTIONS } from '@/modules/order/shared/Order.constant'

type AskUnavailableItemsDependencies = {
  readonly orderRepository: OrderRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
  readonly askCustomer: AskCustomerDecision
}

/** O que foi perguntado. Quem chama usa para saber se ainda há resposta a esperar. */
export type AskUnavailableItemsResult = {
  readonly asked: 'substitution' | 'decision' | 'nothing'
}

function pendingUnavailableItems(detail: OrderDetail): OrderItemRecord[] {
  return detail.items.filter((item) => item.unavailableAt !== null && item.unavailableNotifiedAt === null)
}

export class AskUnavailableItemsUseCase {
  constructor(private readonly dependencies: AskUnavailableItemsDependencies) {}

  async execute(params: { readonly detail: OrderDetail }): Promise<AskUnavailableItemsResult> {
    const pending = pendingUnavailableItems(params.detail)
    if (pending.length === 0) return { asked: 'nothing' }

    /*
     * Acima do teto, nem se procura parecido: um pedido com cinco faltas não tem problema de item, tem
     * problema de pedido — e cinco perguntas seguidas no WhatsApp são cinco chances de a pessoa desistir.
     */
    if (pending.length <= MAX_SUBSTITUTION_QUESTIONS) {
      const offered = await this.offerFirstWithCandidate({ detail: params.detail, pending })
      if (offered) return { asked: 'substitution' }
    }

    /*
     * Manda a pergunta antes de carimbar, pela mesma razão do aviso: carimbar primeiro e falhar no envio
     * deixaria o pedido com "cliente avisado" sobre um recado que ninguém recebeu.
     */
    const message = buildCustomerDecisionMessage({ detail: params.detail, unavailableItems: pending })
    await this.dependencies.askCustomer({
      whatsappNumber: params.detail.order.customerPhone,
      body: message.body,
      buttons: message.buttons,
    })
    await this.dependencies.orderRepository.markUnavailableItemsNotified(params.detail.order.id)

    return { asked: 'decision' }
  }

  /**
   * Pergunta a troca do primeiro item que tiver parecido — e só dele.
   *
   * Uma pergunta por vez porque duas perguntas no WhatsApp produzem resposta para uma delas, e a que
   * ficar sem resposta é um item que ninguém sabe se entra na sacola. O próximo sai depois desta resposta.
   */
  private async offerFirstWithCandidate(params: {
    readonly detail: OrderDetail
    readonly pending: readonly OrderItemRecord[]
  }): Promise<boolean> {
    for (const item of params.pending) {
      const candidate = await this.dependencies.productRepository.findSubstituteCandidate({
        productId: item.productId,
        requiredQuantity: item.quantity,
      })
      if (!candidate) continue

      const message = buildItemSubstitutionMessage({ detail: params.detail, item, candidate })
      await this.dependencies.askCustomer({
        whatsappNumber: params.detail.order.customerPhone,
        body: message.body,
        buttons: message.buttons,
      })
      await this.dependencies.orderRepository.markItemUnavailableNotified({
        orderId: params.detail.order.id,
        itemId: item.id,
      })

      return true
    }

    return false
  }
}
