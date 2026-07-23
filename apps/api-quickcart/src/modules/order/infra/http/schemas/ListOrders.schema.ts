/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * validateQuery colapsa chaves repetidas (só a última sobrevive), então múltiplos
 * status vêm como string única separada por vírgula (?status=confirmed,pending).
 */

import { z } from 'zod'
import {
  LIST_DEFAULT_PAGE,
  LIST_DEFAULT_PER_PAGE,
  LIST_MAX_PER_PAGE,
  ORDER_SORTABLE_FIELDS,
  ORDER_STATUS_VALUES,
} from '@/modules/order/shared/Order.constant'

const statusListSchema = z
  .string()
  .transform((value) => value.split(',').map((item) => item.trim()))
  .pipe(z.array(z.enum(ORDER_STATUS_VALUES)))

export const listOrdersQuerySchema = z.object({
  status: statusListSchema.optional(),
  page: z.coerce.number().int().positive().default(LIST_DEFAULT_PAGE),
  perPage: z.coerce.number().int().positive().max(LIST_MAX_PER_PAGE).default(LIST_DEFAULT_PER_PAGE),
  sortBy: z.enum(ORDER_SORTABLE_FIELDS).default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
})
