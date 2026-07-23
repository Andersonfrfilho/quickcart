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

export type GetOrderByShortCodeParams = {
  readonly shortCode: string
  readonly requesterPhone?: string | undefined
}

export type GetOrderByShortCodeResult = {
  readonly order: OrderRecord
  readonly items: OrderItemRecord[]
}
