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

export type LinkCustomerToUserParams = {
  readonly customerId: string
  readonly userId: string
}

export type UpdateContactInfoParams = {
  readonly customerId: string
  readonly email?: string | undefined
}

export interface CustomerRepositoryInterface {
  findById(id: string): Promise<Customer | undefined>
  findByPhone(phone: string): Promise<Customer | undefined>
  upsertByPhone(params: UpsertCustomerByPhoneParams): Promise<Customer>
  updateContactInfo(params: UpdateContactInfoParams): Promise<Customer>
  /** Quem é o cliente por trás de um login. `undefined` = login que nunca comprou. */
  findByUserId(userId: string): Promise<Customer | undefined>
  /** Liga a identidade de compra à de login. Chamado uma vez, no cadastro. */
  linkToUser(params: LinkCustomerToUserParams): Promise<Customer>
}
