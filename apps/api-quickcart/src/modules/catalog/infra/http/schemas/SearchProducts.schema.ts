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
import { SEARCH_MAX_LIMIT } from '@/modules/catalog/shared/Catalog.constant'

export const searchProductsQuerySchema = z.object({
  query: z.string().min(1),
  limit: z.coerce.number().int().positive().max(SEARCH_MAX_LIMIT).optional(),
})
