/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O status do pedido na voz de quem está esperando por ele.
 *
 * Vive no módulo `conversation`, e não em `order`, porque é tradução para o cliente — a esteira da
 * loja continua falando `separated` e `awaiting_customer_decision`. Mostrar o valor do enum ao
 * cliente seria entregar vocabulário interno a quem só quer saber se dá tempo de tomar banho.
 */

import { DELIVERY_TYPE, ORDER_STATUS } from '@/modules/order/shared/Order.constant'

import { MESSAGES } from './Messages.constant'

/**
 * Pedido que ainda vai acontecer alguma coisa. Só estes dois desfechos encerram o assunto.
 *
 * Lista de negação curta de propósito: status novo nasce "vivo", porque o erro barato é o bot
 * acompanhar um pedido que já terminou, e o caro é ele abrir o menu de boas-vindas no meio de uma
 * entrega — que é exatamente o que este estado existe para evitar.
 */
const FINISHED_ORDER_STATUSES: ReadonlySet<string> = new Set([ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED])

export function isOrderStillRunning(status: string): boolean {
  return !FINISHED_ORDER_STATUSES.has(status)
}

const ORDER_SITUATION_BY_STATUS: Readonly<Record<string, string>> = {
  [ORDER_STATUS.PENDING_CONFIRMATION]: MESSAGES.ORDER_SITUATION_PENDING_CONFIRMATION,
  [ORDER_STATUS.CONFIRMED]: MESSAGES.ORDER_SITUATION_CONFIRMED,
  [ORDER_STATUS.PREPARING]: MESSAGES.ORDER_SITUATION_PREPARING,
  [ORDER_STATUS.SEPARATED]: MESSAGES.ORDER_SITUATION_SEPARATED,
  [ORDER_STATUS.AWAITING_CUSTOMER_DECISION]: MESSAGES.ORDER_SITUATION_AWAITING_CUSTOMER_DECISION,
  [ORDER_STATUS.OUT_FOR_DELIVERY]: MESSAGES.ORDER_SITUATION_OUT_FOR_DELIVERY,
  [ORDER_STATUS.IN_TRANSIT]: MESSAGES.ORDER_SITUATION_IN_TRANSIT,
  [ORDER_STATUS.ARRIVED_AT_CUSTOMER]: MESSAGES.ORDER_SITUATION_ARRIVED_AT_CUSTOMER,
  [ORDER_STATUS.READY_FOR_PICKUP]: MESSAGES.ORDER_SITUATION_READY_FOR_PICKUP,
  [ORDER_STATUS.DELIVERY_FAILED]: MESSAGES.ORDER_SITUATION_DELIVERY_FAILED,
}

export type DescribeOrderSituationParams = {
  readonly status: string
  readonly deliveryType: string
}

/**
 * Status sem frase cai em "estamos separando": é o degrau mais provável e o mais inofensivo de errar.
 * Mentir para cima ("saiu para entrega") faria alguém descer para a portaria à toa.
 *
 * `separated` é o único degrau que depende do tipo de entrega, e por isso a função recebe o pedido e
 * não só o status: a sacola separada de uma RETIRADA não está "saindo em instantes" — ela está no
 * balcão esperando o cliente, e dizer o contrário manda ele ficar em casa aguardando um entregador
 * que nunca foi sair.
 */
export function describeOrderSituation(params: DescribeOrderSituationParams): string {
  if (params.status === ORDER_STATUS.SEPARATED && params.deliveryType === DELIVERY_TYPE.PICKUP) {
    return MESSAGES.ORDER_SITUATION_READY_FOR_PICKUP
  }

  return ORDER_SITUATION_BY_STATUS[params.status] ?? MESSAGES.ORDER_SITUATION_PREPARING
}
