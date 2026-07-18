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
import {
  LIST_DEFAULT_PAGE,
  LIST_DEFAULT_PER_PAGE,
  LIST_MAX_PER_PAGE,
  PRODUCT_SORTABLE_FIELDS,
} from '@/modules/catalog/shared/Catalog.constant'

export const listProductsQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(LIST_DEFAULT_PAGE),
  perPage: z.coerce.number().int().positive().max(LIST_MAX_PER_PAGE).default(LIST_DEFAULT_PER_PAGE),
  sortBy: z.enum(PRODUCT_SORTABLE_FIELDS).default('name'),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
})
