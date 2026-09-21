/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { z } from 'zod'
import { PRODUCT_UNITS } from '@/modules/catalog/shared/Catalog.constant'

export const createProductSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(160),
  brand: z.string().max(80).optional(),
  description: z.string().optional(),
  unit: z.enum(PRODUCT_UNITS),
  unitSize: z.string().max(24).optional(),
  priceInCents: z.number().int().nonnegative(),
  stockQuantity: z.number().int().nonnegative().default(0),
  isAvailable: z.boolean().default(true),
  imageUrl: z.string().url().optional(),
  aisle: z.string().max(60).optional(),
  aliases: z.array(z.string().min(1)).default([]),
  barcode: z.string().max(14).optional(),
})
