/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { OrderRecord } from '@/modules/order/domain/OrderRepository.interface'
import type { OrderStatus } from '@/modules/order/shared/Order.constant'

export type UpdateOrderStatusParams = {
  readonly orderId: string
  readonly status: OrderStatus
}

export type UpdateOrderStatusResult = {
  readonly order: OrderRecord
}
