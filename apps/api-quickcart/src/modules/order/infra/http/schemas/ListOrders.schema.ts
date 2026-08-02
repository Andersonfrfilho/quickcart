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

/**
 * Lista separada por vírgula, como o resto dos filtros da API.
 *
 * Seleção múltipla é padrão do projeto: filtro de valor único obriga o operador a escolher entre ver
 * "aguardando" e ver "preparando", quando o trabalho dele é justamente olhar os dois.
 */
const csvListSchema = z
  .string()
  .transform((value) => value.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0))
  .refine((entries) => entries.length > 0, { message: 'informe ao menos um valor' })

export const listOrdersQuerySchema = z.object({
  status: statusListSchema.optional(),
  /** Busca livre por nome, telefone ou código do pedido — o que o operador tem à mão ao telefone. */
  search: z.string().trim().min(1).max(120).optional(),
  deliveryType: csvListSchema.optional(),
  paymentMethod: csvListSchema.optional(),
  page: z.coerce.number().int().positive().default(LIST_DEFAULT_PAGE),
  perPage: z.coerce.number().int().positive().max(LIST_MAX_PER_PAGE).default(LIST_DEFAULT_PER_PAGE),
  sortBy: z.enum(ORDER_SORTABLE_FIELDS).default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
})
