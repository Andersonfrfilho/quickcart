/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { OrderWithCustomer } from '@/modules/order/domain/OrderRepository.interface'

export type ListOrdersParams = {
  readonly status?: readonly string[] | undefined
  readonly search?: string | undefined
  readonly deliveryType?: readonly string[] | undefined
  readonly paymentMethod?: readonly string[] | undefined
  readonly page: number
  readonly perPage: number
  readonly sortBy: 'createdAt' | 'totalInCents' | 'status'
  readonly sortDirection: 'asc' | 'desc'
}

export type ListOrdersResult = {
  readonly items: readonly OrderWithCustomer[]
  readonly total: number
  readonly page: number
  readonly perPage: number
}
