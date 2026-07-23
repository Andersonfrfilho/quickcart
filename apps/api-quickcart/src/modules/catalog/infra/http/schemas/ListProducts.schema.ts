/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * validateQuery colapsa chaves repetidas (só a última sobrevive), então múltiplas
 * categorias vêm como string única separada por vírgula (?categoryId=uuid1,uuid2).
 */

import { z } from 'zod'
import {
  LIST_DEFAULT_PAGE,
  LIST_DEFAULT_PER_PAGE,
  LIST_MAX_PER_PAGE,
  PRODUCT_SORTABLE_FIELDS,
} from '@/modules/catalog/shared/Catalog.constant'

const categoryIdListSchema = z
  .string()
  .transform((value) => value.split(',').map((item) => item.trim()))
  .pipe(z.array(z.string().uuid()))

export const listProductsQuerySchema = z.object({
  categoryId: categoryIdListSchema.optional(),
  page: z.coerce.number().int().positive().default(LIST_DEFAULT_PAGE),
  perPage: z.coerce.number().int().positive().max(LIST_MAX_PER_PAGE).default(LIST_DEFAULT_PER_PAGE),
  sortBy: z.enum(PRODUCT_SORTABLE_FIELDS).default('name'),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
})
