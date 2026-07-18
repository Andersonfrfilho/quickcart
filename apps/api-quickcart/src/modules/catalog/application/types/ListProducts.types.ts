/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { Product } from '@/infra/database/schema'

export type ListProductsParams = {
  readonly categoryId?: string | undefined
  readonly onlyAvailable: boolean
  readonly page: number
  readonly perPage: number
  readonly sortBy: 'name' | 'priceInCents' | 'stockQuantity' | 'createdAt'
  readonly sortDirection: 'asc' | 'desc'
}

export type ListProductsResult = {
  readonly items: readonly Product[]
  readonly total: number
  readonly page: number
  readonly perPage: number
}
