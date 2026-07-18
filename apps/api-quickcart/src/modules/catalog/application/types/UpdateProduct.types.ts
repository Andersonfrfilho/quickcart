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

export type UpdateProductParams = {
  readonly id: string
  readonly categoryId?: string | undefined
  readonly name?: string | undefined
  readonly brand?: string | null | undefined
  readonly description?: string | null | undefined
  readonly unit?: string | undefined
  readonly unitSize?: string | null | undefined
  readonly priceInCents?: number | undefined
  readonly isAvailable?: boolean | undefined
  readonly imageUrl?: string | null | undefined
  readonly aliases?: readonly string[] | undefined
  readonly barcode?: string | null | undefined
}

export type UpdateProductResult = Product
