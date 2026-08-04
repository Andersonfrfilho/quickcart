/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A esteira de status do pedido — a regra vive aqui, no servidor.
 *
 * Ela existia só no frontend, como mapa que decidia quais botões desenhar. A rota aceitava qualquer valor
 * do enum sem olhar o estado atual, então uma aba aberta desde a manhã, um `curl` ou um duplo clique
 * movia pedido concluído de volta para "aguardando confirmação" — e cada transição dispara mensagem ao
 * cliente, então o estrago sai da tela e chega no WhatsApp de quem comprou.
 *
 * Guarda-corpo no cliente é conveniência; no servidor é garantia. O frontend continua desenhando botões,
 * mas a partir da lista que a API devolve, para não existirem duas verdades sobre a mesma esteira.
 */

import { DELIVERY_TYPE, ORDER_STATUS, type OrderStatus } from '@/modules/order/shared/Order.constant'

/**
 * Para onde cada estado pode ir. Ausente do mapa = estado final.
 *
 * `completed` e `cancelled` não têm saída de propósito: reabrir pedido concluído ou ressuscitar cancelado
 * não é transição, é outra operação — e se um dia precisar existir, precisa de nome, registro e provavelmente
 * autorização diferente.
 */
const ORDER_STATUS_TRANSITIONS: Readonly<Record<string, readonly OrderStatus[]>> = {
  [ORDER_STATUS.PENDING_CONFIRMATION]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.SEPARATED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SEPARATED]: [
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.READY_FOR_PICKUP,
    ORDER_STATUS.CANCELLED,
  ],
  [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.COMPLETED],
  [ORDER_STATUS.READY_FOR_PICKUP]: [ORDER_STATUS.COMPLETED],
}

/**
 * Passos que só existem para um tipo de entrega.
 *
 * "Saiu para entrega" numa retirada avisa o cliente de que a compra está indo até ele e deixa a sacola no
 * balcão esperando. O erro só aparece quando alguém liga reclamando, então não pode depender de a tela ter
 * escondido o botão.
 */
const STATUS_REQUIRES_DELIVERY_TYPE: Readonly<Record<string, string>> = {
  [ORDER_STATUS.OUT_FOR_DELIVERY]: DELIVERY_TYPE.DELIVERY,
  [ORDER_STATUS.READY_FOR_PICKUP]: DELIVERY_TYPE.PICKUP,
}

export type OrderStatusFlowParams = {
  readonly status: string
  readonly deliveryType: string
}

/** Próximos estados válidos para ESTE pedido. É o que a API devolve para a tela desenhar. */
export function allowedNextStatuses(params: OrderStatusFlowParams): readonly OrderStatus[] {
  return (ORDER_STATUS_TRANSITIONS[params.status] ?? []).filter((next) => {
    const required = STATUS_REQUIRES_DELIVERY_TYPE[next]
    return required === undefined || required === params.deliveryType
  })
}

export function canTransitionTo(params: OrderStatusFlowParams & { readonly nextStatus: string }): boolean {
  return allowedNextStatuses(params).some((allowed) => allowed === params.nextStatus)
}
