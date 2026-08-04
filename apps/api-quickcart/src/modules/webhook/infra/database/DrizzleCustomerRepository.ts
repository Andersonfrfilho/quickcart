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
import { customers, type Customer } from '@/infra/database/schema'
import { generateId } from '@/shared/id'
import type {
  CustomerRepositoryInterface,
  UpdateContactInfoParams,
  UpsertCustomerByPhoneParams,
} from '@/modules/webhook/domain/CustomerRepository.interface'

export class DrizzleCustomerRepository implements CustomerRepositoryInterface {
  async findById(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1)
    return customer
  }

  async findByPhone(phone: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1)
    return customer
  }

  async upsertByPhone(params: UpsertCustomerByPhoneParams): Promise<Customer> {
    const [customer] = await db
      .insert(customers)
      .values({ id: generateId(), phone: params.phone, name: params.name ?? null })
      .onConflictDoUpdate({
        target: customers.phone,
        set: { updatedAt: new Date(), ...(params.name ? { name: params.name } : {}) },
      })
      .returning()

    return customer as Customer
  }

  async updateContactInfo(params: UpdateContactInfoParams): Promise<Customer> {
    const [customer] = await db
      .update(customers)
      .set({
        updatedAt: new Date(),
        ...(params.email !== undefined ? { email: params.email } : {}),
      })
      .where(eq(customers.id, params.customerId))
      .returning()

    return customer as Customer
  }
}
