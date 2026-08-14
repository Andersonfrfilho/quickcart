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

export const updateProductSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().min(1).max(160).optional(),
  brand: z.string().max(80).nullable().optional(),
  description: z.string().nullable().optional(),
  unit: z.enum(PRODUCT_UNITS).optional(),
  unitSize: z.string().max(24).nullable().optional(),
  priceInCents: z.number().int().nonnegative().optional(),
  isAvailable: z.boolean().optional(),
  imageUrl: z.string().url().nullable().optional(),
  aisle: z.string().max(60).nullable().optional(),
  aliases: z.array(z.string().min(1)).optional(),
  barcode: z.string().max(14).nullable().optional(),
})
