/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { eq } from 'drizzle-orm'
import { db } from '@/infra/database/connection'
import { customers, orders } from '@/infra/database/schema'

export type OrderNotificationData = {
  readonly orderId: string
  readonly shortCode: string
  readonly customerPhone: string
}

export async function findOrderNotificationData(orderId: string): Promise<OrderNotificationData | undefined> {
  const [row] = await db
    .select({
      orderId: orders.id,
      shortCode: orders.shortCode,
      customerPhone: customers.phone,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.id, orderId))
    .limit(1)

  return row
}
