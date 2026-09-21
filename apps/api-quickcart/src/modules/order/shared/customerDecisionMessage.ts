/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A pergunta sobre os itens em falta, montada num lugar só.
 *
 * Duas coisas a fazem: o aviso da loja e a cobrança automática horas depois. Se cada uma montasse o próprio
 * texto, a cobrança acabaria listando itens diferentes dos que o cliente viu na primeira mensagem — ou
 * oferecendo "seguir assim" num pedido onde já não sobrou nada. É a mesma pergunta, então é o mesmo código.
 */

import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'
import {
  buildOrderDecisionButtons,
  type OrderDecisionButton,
} from '@/modules/conversation/shared/orderDecisionButton'
import type { OrderDetail, OrderItemRecord } from '@/modules/order/domain/OrderRepository.interface'

/**
 * Como a pergunta chega ao cliente. Um tipo só para o aviso e para a cobrança.
 *
 * Assinatura idêntica de propósito: se as duas divergirem, uma delas acaba mandando a pergunta sem os
 * botões — e uma pergunta sem botão volta como texto livre, que é o trabalho manual que isto elimina.
 */
export type AskCustomerDecision = (params: {
  readonly whatsappNumber: string
  readonly body: string
  readonly buttons: readonly OrderDecisionButton[]
}) => Promise<void>

/**
 * Como o aviso SEM pergunta chega ao cliente. Texto puro, e é o ponto: nada aqui espera resposta.
 */
export type NotifyCustomer = (params: {
  readonly whatsappNumber: string
  readonly body: string
}) => Promise<void>

export type CustomerDecisionMessage = {
  readonly body: string
  readonly buttons: readonly OrderDecisionButton[]
  /** `false` quando toda a sacola caiu — quem chama usa para saber que não há o que seguir. */
  readonly hasAnythingLeft: boolean
}

function buildItemLines(unavailableItems: readonly OrderItemRecord[]): string {
  return unavailableItems.map((item) => `• ${Number(item.quantity)}x ${item.productName}`).join('\n')
}

export function hasAnythingLeftToDeliver(detail: OrderDetail): boolean {
  return detail.items.some((item) => item.unavailableAt === null)
}

/**
 * O aviso que a loja manda quando JÁ decidiu seguir sem os itens.
 *
 * Mesmos itens, mesmo total, texto diferente: "Seguimos com o resto?" e "Sigo com o restante" dizem coisas
 * opostas sobre quem decide, e mandar a pergunta quando ninguém vai esperar a resposta é o pior dos dois.
 *
 * Só faz sentido com algo restando — sem isso, "sigo com o restante" seria uma entrega vazia. Quem chama
 * garante essa condição (ver `OrderCustomerApprovalRequiredError`).
 */
export function buildUnavailableNoticeBody(params: {
  readonly detail: OrderDetail
  readonly unavailableItems: readonly OrderItemRecord[]
}): string {
  return MESSAGES.ORDER_ITEMS_UNAVAILABLE_NOTICE.replace('{codigo}', params.detail.order.shortCode)
    .replace('{itens}', buildItemLines(params.unavailableItems))
    .replace('{total}', formatPriceInCents(params.detail.order.totalInCents))
}

export function buildCustomerDecisionMessage(params: {
  readonly detail: OrderDetail
  /** Os itens que entram no recado. Na cobrança são todos os já avisados; no aviso, só os novos. */
  readonly unavailableItems: readonly OrderItemRecord[]
}): CustomerDecisionMessage {
  const itemLines = buildItemLines(params.unavailableItems)
  const hasAnythingLeft = hasAnythingLeftToDeliver(params.detail)

  /**
   * Nada sobrou: outra conversa, não o mesmo recado com total zero.
   *
   * "O novo total é R$ 0,00" deixaria o cliente esperando uma entrega vazia. Quando não há o que
   * entregar, a pergunta certa é se ele quer montar outra lista ou cancelar.
   */
  const body = hasAnythingLeft
    ? MESSAGES.ORDER_ITEMS_UNAVAILABLE.replace('{codigo}', params.detail.order.shortCode)
        .replace('{itens}', itemLines)
        .replace('{total}', formatPriceInCents(params.detail.order.totalInCents))
    : MESSAGES.ORDER_ALL_ITEMS_UNAVAILABLE.replace('{codigo}', params.detail.order.shortCode).replace(
        '{itens}',
        itemLines,
      )

  return {
    body,
    buttons: buildOrderDecisionButtons({ orderId: params.detail.order.id, hasAnythingLeft }),
    hasAnythingLeft,
  }
}
