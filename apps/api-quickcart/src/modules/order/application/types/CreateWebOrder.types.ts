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
import type { AddressInput } from '@/modules/shared/address/Address.schema'

export type CreateWebOrderItemInput = {
  readonly productId: string
  readonly quantity: number
}

export type CreateWebOrderCustomerInput = {
  readonly name: string
  readonly phone: string
  readonly email?: string | undefined
}

export type CreateWebOrderParams = {
  readonly idempotencyKey: string
  readonly customer: CreateWebOrderCustomerInput
  readonly items: ReadonlyArray<CreateWebOrderItemInput>
  readonly deliveryType: string
  readonly address?: AddressInput | undefined
  readonly paymentMethod: string
  readonly receiptPreference: string
  readonly notes?: string | undefined
}

export type CreateWebOrderResult = {
  readonly order: OrderRecord
  readonly items: OrderItemRecord[]
}
