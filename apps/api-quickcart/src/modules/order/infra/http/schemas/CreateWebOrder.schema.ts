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
  DELIVERY_TYPE_VALUES,
  PAYMENT_METHOD_VALUES,
  RECEIPT_PREFERENCE_VALUES,
} from '@/modules/order/shared/Order.constant'

export const createWebOrderBodySchema = z.object({
  customer: z.object({
    name: z.string().min(1),
    phone: z.string().min(8),
    email: z.string().email().optional(),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().positive(),
      }),
    )
    .min(1),
  deliveryType: z.enum(DELIVERY_TYPE_VALUES),
  address: z.unknown().optional(),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES),
  receiptPreference: z.enum(RECEIPT_PREFERENCE_VALUES),
  notes: z.string().optional(),
})
