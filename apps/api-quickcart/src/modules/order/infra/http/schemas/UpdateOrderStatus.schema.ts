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
import { ORDER_STATUS_VALUES } from '@/modules/order/shared/Order.constant'

export const updateOrderStatusBodySchema = z.object({
  status: z.enum(ORDER_STATUS_VALUES),
})
