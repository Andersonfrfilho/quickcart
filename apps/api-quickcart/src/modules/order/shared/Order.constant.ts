/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

export const ORDER_STATUS = {
  PENDING_CONFIRMATION: 'pending_confirmation',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  /**
   * Separado: os itens estão na sacola e o pedido espera entregador ou cliente.
   *
   * Faltava um estado entre "preparando" e "saiu para entrega": a esteira ia direto de um ao outro, e
   * quem terminava de separar um pedido de entrega só tinha o botão "saiu para entrega" — que é mentira
   * enquanto ninguém saiu. Sem esse degrau, quem olha a lista não distingue o que está pronto do que
   * ainda está sendo montado, que é a pergunta do balcão inteiro.
   */
  SEPARATED: 'separated',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  READY_FOR_PICKUP: 'ready_for_pickup',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]

export const DELIVERY_TYPE = {
  DELIVERY: 'delivery',
  PICKUP: 'pickup',
} as const

export type DeliveryType = (typeof DELIVERY_TYPE)[keyof typeof DELIVERY_TYPE]

export const PAYMENT_METHOD = {
  PIX: 'pix',
  CARD_ON_DELIVERY: 'card_on_delivery',
  CASH: 'cash',
} as const

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD]

export const RECEIPT_PREFERENCE = {
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
  BOTH: 'both',
} as const

export type ReceiptPreference = (typeof RECEIPT_PREFERENCE)[keyof typeof RECEIPT_PREFERENCE]

export const ORDER_IDEMPOTENCY_CACHE_PREFIX = 'order:idempotency:'
export const ORDER_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60
export const ORDER_IDEMPOTENCY_PENDING_SENTINEL = 'pending'
export const ORDER_IDEMPOTENCY_POLL_INTERVAL_MS = 100
export const ORDER_IDEMPOTENCY_POLL_TIMEOUT_MS = 5000

export const LIST_DEFAULT_PAGE = 1
export const LIST_DEFAULT_PER_PAGE = 20
export const LIST_MAX_PER_PAGE = 100

export const ORDER_SORTABLE_FIELDS = ['createdAt', 'totalInCents', 'status'] as const
export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUS) as [OrderStatus, ...OrderStatus[]]
export const DELIVERY_TYPE_VALUES = Object.values(DELIVERY_TYPE) as [DeliveryType, ...DeliveryType[]]
export const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHOD) as [PaymentMethod, ...PaymentMethod[]]
export const RECEIPT_PREFERENCE_VALUES = Object.values(RECEIPT_PREFERENCE) as [ReceiptPreference, ...ReceiptPreference[]]
