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

const PHONE_DIGITS = /^\d{10,13}$/

export const registerCustomerBodySchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  /** Só dígitos: o telefone é a chave de `customers`, e "(11) 9…" e "11 9…" seriam duas pessoas. */
  phone: z.string().regex(PHONE_DIGITS, 'Telefone deve conter apenas dígitos, com DDD'),
  password: z.string().min(8).max(200),
})

export const listMyOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(50).default(20),
})
