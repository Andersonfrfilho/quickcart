/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Quando a lista do cliente precisa se perguntar de novo.
 *
 * Aqui não há stream: o canal `order:<id>` é da operação, autenticado por ticket de operador, e o
 * cliente não tem — dar um a ele seria abrir a esteira interna da loja para fora. Então esta tela
 * depende de perguntar, e a única defesa contra perguntar à toa é perguntar só quando há motivo.
 *
 * E na maior parte do tempo não há: quem abre "Meus pedidos" costuma estar olhando histórico, não
 * uma entrega em curso. Uma lista só de pedidos entregues não muda mais — perguntar de dez em dez
 * segundos ali é gastar a bateria do celular de quem está no ônibus.
 */

import { ORDER_STATUS, type OrderStatus } from '@/shared/api/api.types'

/**
 * O pedido saiu da loja e está a caminho. É a única fase em que o cliente fica com a tela aberta
 * esperando a informação mudar, e onde meio minuto de atraso é a diferença entre descer a tempo e
 * perder o entregador na portaria.
 */
const DELIVERY_IN_PROGRESS_STATUSES: ReadonlySet<string> = new Set([
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.IN_TRANSIT,
  ORDER_STATUS.ARRIVED_AT_CUSTOMER,
])

/** Chegou ao fim: entregue, cancelado, ou parado esperando a loja resolver a falha. */
const SETTLED_STATUSES: ReadonlySet<string> = new Set([
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.DELIVERY_FAILED,
])

const DELIVERY_REFETCH_INTERVAL_MS = 15_000
const IN_STORE_REFETCH_INTERVAL_MS = 60_000

export type MyOrdersRefetchParams = {
  readonly statuses: readonly OrderStatus[] | undefined
}

/** `false` no lugar de zero porque é o que o react-query entende por "não repetir". */
export function resolveMyOrdersRefetchInterval({ statuses }: MyOrdersRefetchParams): number | false {
  if (!statuses || statuses.length === 0) return false

  const liveStatuses = statuses.filter((status) => !SETTLED_STATUSES.has(status))
  if (liveStatuses.length === 0) return false

  /*
   * O pedido mais adiantado manda no intervalo. Quem tem uma entrega na rua e três compras antigas na
   * mesma página está olhando a entrega — usar a média, ou o primeiro da lista, faria a tela mais
   * lenta justamente para quem mais precisa dela rápida.
   */
  return liveStatuses.some((status) => DELIVERY_IN_PROGRESS_STATUSES.has(status))
    ? DELIVERY_REFETCH_INTERVAL_MS
    : IN_STORE_REFETCH_INTERVAL_MS
}
