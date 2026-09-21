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

export type CreateProductParams = {
  readonly categoryId: string
  readonly name: string
  readonly brand?: string | undefined
  readonly description?: string | undefined
  readonly unit: string
  readonly unitSize?: string | undefined
  readonly priceInCents: number
  readonly stockQuantity: number
  readonly isAvailable: boolean
  readonly imageUrl?: string | undefined
  readonly aisle?: string | undefined
  readonly aliases: readonly string[]
  readonly barcode?: string | undefined
}

export type CreateProductResult = Product
