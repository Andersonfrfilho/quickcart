/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Espelha apps/api-quickcart/src/modules/order/shared/Order.constant.ts (só os valores que o
 * worker consome). UpdateOrderStatus.use-case.ts enfileira { orderId, status } com esses
 * mesmos literais — manter em sincronia entre os dois processos.
 */

export const ORDER_STATUS = {
  PENDING_CONFIRMATION: 'pending_confirmation',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  /** Itens já separados, esperando entregador ou cliente. Ver api-quickcart/Order.constant.ts. */
  SEPARATED: 'separated',
  /** Separação parada esperando o cliente decidir sobre item em falta. Desvio, não degrau da esteira. */
  AWAITING_CUSTOMER_DECISION: 'awaiting_customer_decision',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  /** Degraus do trajeto até a porta. Ver api-quickcart/Order.constant.ts. */
  IN_TRANSIT: 'in_transit',
  ARRIVED_AT_CUSTOMER: 'arrived_at_customer',
  READY_FOR_PICKUP: 'ready_for_pickup',
  /** A entrega não aconteceu; o motivo mora no pedido, e é ele que diz se cabe outra tentativa. */
  DELIVERY_FAILED: 'delivery_failed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]

export const PAYMENT_METHOD = {
  PIX: 'pix',
  CARD_ON_DELIVERY: 'card_on_delivery',
  CASH: 'cash',
} as const

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD]
