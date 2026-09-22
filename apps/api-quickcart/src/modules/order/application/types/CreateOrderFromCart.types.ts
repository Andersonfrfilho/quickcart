/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { OrderItemRecord, OrderRecord } from '@/modules/order/domain/OrderRepository.interface'

export type CreateOrderFromCartParams = {
  readonly cartId: string
  readonly customerId: string
  readonly channel: string
  readonly deliveryType: string
  readonly address?: unknown
  readonly paymentMethod: string
  readonly receiptPreference: string
  readonly notes?: string | undefined
  /** Troco no pagamento em dinheiro. Ausente ou `null` = não precisa, ou pagamento não é em dinheiro. */
  readonly cashChangeForInCents?: number | null | undefined
  /**
   * A taxa cotada pela faixa quando o endereço ficou pronto, gravada no contexto do checkout. Vem daqui,
   * e não de uma recotação, para o pedido cobrar o mesmo valor contra o qual o troco foi validado.
   */
  readonly quotedDeliveryFeeInCents: number
  /**
   * Snapshot da mesma cotação (spec §3.7): distância, teto e taxa da faixa, e a fonte da localização.
   * Nulos na retirada; opcionais porque o checkout web monta o pedido por outro use case.
   */
  readonly quotedDeliveryDistanceKm?: number | null | undefined
  readonly quotedDeliveryTierMaxKm?: number | null | undefined
  readonly quotedDeliveryTierFeeInCents?: number | null | undefined
  readonly quotedDeliveryLocationSource?: string | null | undefined
}

export type CreateOrderFromCartResult = {
  readonly order: OrderRecord
  readonly items: OrderItemRecord[]
}
