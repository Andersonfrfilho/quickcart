/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { Customer } from '@/infra/database/schema'

export type UpsertCustomerByPhoneParams = {
  readonly phone: string
  readonly name?: string | undefined
}

export type UpdateContactInfoParams = {
  readonly customerId: string
  readonly email?: string | undefined
  readonly defaultAddress?: unknown
}

export interface CustomerRepositoryInterface {
  findById(id: string): Promise<Customer | undefined>
  findByPhone(phone: string): Promise<Customer | undefined>
  upsertByPhone(params: UpsertCustomerByPhoneParams): Promise<Customer>
  updateContactInfo(params: UpdateContactInfoParams): Promise<Customer>
}
