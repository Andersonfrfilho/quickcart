/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Porta do "este pedido mudou". O payload é deliberadamente magro — id e motivo, nada do pedido em si.
 *
 * Mandar o pedido inteiro pelo canal criaria uma segunda serialização de pedido fora do
 * `withAllowedTransitions`, e as duas divergiriam no primeiro campo novo. O evento avisa; quem recebe
 * busca pela rota que já existe, e continua havendo um só lugar que sabe desenhar um pedido.
 */

export const ORDER_CHANGE_REASON = {
  /** Pedido novo. Só interessa à lista — não existe tela de detalhe aberta num pedido que acabou de nascer. */
  CREATED: 'created',
  STATUS: 'status',
  ITEM_PICKED: 'item_picked',
  ITEM_UNAVAILABLE: 'item_unavailable',
  UNAVAILABLE_NOTIFIED: 'unavailable_notified',
  /** A resposta do cliente no WhatsApp: a única que não nasce de um toque na própria tela. */
  CUSTOMER_DECISION: 'customer_decision',
} as const

export type OrderChangeReason = (typeof ORDER_CHANGE_REASON)[keyof typeof ORDER_CHANGE_REASON]

export type NotifyOrderChangedParams = {
  readonly orderId: string
  readonly reason: OrderChangeReason
}

export interface OrderRealtimeNotifierInterface {
  notifyOrderChanged(params: NotifyOrderChangedParams): void
}
