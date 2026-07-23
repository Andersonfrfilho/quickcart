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

export type ListOrdersParams = {
  readonly status?: readonly string[] | undefined
  readonly page: number
  readonly perPage: number
  readonly sortBy: 'createdAt' | 'totalInCents' | 'status'
  readonly sortDirection: 'asc' | 'desc'
}

export type ListOrdersResult = {
  readonly items: readonly OrderRecord[]
  readonly total: number
  readonly page: number
  readonly perPage: number
}
