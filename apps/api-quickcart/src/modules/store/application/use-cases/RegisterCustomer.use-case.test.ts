/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { describe, expect, it } from 'bun:test'
import type { UserModule } from '@adatechnology/user-module'
import type { UserProfile } from '@adatechnology/user-contracts'

import type { Customer } from '@/infra/database/schema/customers'
import type {
  CustomerRepositoryInterface,
  LinkCustomerToUserParams,
  UpdateContactInfoParams,
  UpsertCustomerByPhoneParams,
} from '@/modules/webhook/domain/CustomerRepository.interface'
import { ConflictError } from '@/shared/errors/AppError.error'
import { QUICKCART_ROLE } from '@/modules/user/shared/User.constant'

import { RegisterCustomerUseCase } from './RegisterCustomer.use-case'

const USER_ID = '44444444-4444-4444-8444-444444444444'
const EXISTING_CUSTOMER_ID = '55555555-5555-4555-8555-555555555555'

function buildCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: EXISTING_CUSTOMER_ID,
    phone: '11999998888',
    name: 'Pessoa',
    email: null,
    userId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

class FakeCustomerRepository implements CustomerRepositoryInterface {
  upserted: UpsertCustomerByPhoneParams[] = []
  linked: LinkCustomerToUserParams[] = []

  constructor(private readonly existing: Customer | undefined) {}

  async findById(): Promise<Customer | undefined> {
    return undefined
  }

  async findByPhone(): Promise<Customer | undefined> {
    return this.existing
  }

  async findByUserId(): Promise<Customer | undefined> {
    return undefined
  }

  async upsertByPhone(params: UpsertCustomerByPhoneParams): Promise<Customer> {
    this.upserted.push(params)
    return buildCustomer({ id: 'novo-customer', phone: params.phone })
  }

  async linkToUser(params: LinkCustomerToUserParams): Promise<Customer> {
    this.linked.push(params)
    return buildCustomer({ id: params.customerId, userId: params.userId })
  }

  async updateContactInfo(params: UpdateContactInfoParams): Promise<Customer> {
    return buildCustomer({ id: params.customerId })
  }
}

type CreateUserCall = { readonly email: string; readonly role: string }

function buildUserModule(calls: CreateUserCall[]): UserModule {
  return {
    useCases: {
      createUser: {
        async execute(params: { email: string; role: string; name: string }): Promise<UserProfile> {
          calls.push({ email: params.email, role: params.role })
          return { id: USER_ID, email: params.email, name: params.name, role: params.role, isActive: true }
        },
      },
    },
  } as unknown as UserModule
}

const params = {
  name: 'Pessoa',
  email: 'pessoa@exemplo.test',
  phone: '11999998888',
  password: 'senha-bem-comprida',
}

describe('RegisterCustomerUseCase', () => {
  it('cria o usuário com papel cliente — o papel nunca vem da requisição', async () => {
    const calls: CreateUserCall[] = []
    const customerRepository = new FakeCustomerRepository(undefined)

    await new RegisterCustomerUseCase({ userModule: buildUserModule(calls), customerRepository }).execute(params)

    expect(calls).toEqual([{ email: params.email, role: QUICKCART_ROLE.CUSTOMER }])
  })

  it('ADOTA o cliente que já existe com o mesmo telefone, em vez de criar outro', async () => {
    const customerRepository = new FakeCustomerRepository(buildCustomer())

    const result = await new RegisterCustomerUseCase({
      userModule: buildUserModule([]),
      customerRepository,
    }).execute(params)

    // Nenhum upsert: a linha antiga — e com ela os pedidos antigos — é a que recebe o login.
    expect(customerRepository.upserted).toEqual([])
    expect(customerRepository.linked).toEqual([{ customerId: EXISTING_CUSTOMER_ID, userId: USER_ID }])
    expect(result.customerId).toBe(EXISTING_CUSTOMER_ID)
  })

  it('cria cliente novo quando o telefone é desconhecido', async () => {
    const customerRepository = new FakeCustomerRepository(undefined)

    await new RegisterCustomerUseCase({ userModule: buildUserModule([]), customerRepository }).execute(params)

    expect(customerRepository.upserted).toEqual([{ phone: params.phone, name: params.name }])
  })

  it('recusa telefone já ligado a outra conta, sem criar usuário', async () => {
    const calls: CreateUserCall[] = []
    const customerRepository = new FakeCustomerRepository(buildCustomer({ userId: 'outro-usuario' }))

    const promise = new RegisterCustomerUseCase({
      userModule: buildUserModule(calls),
      customerRepository,
    }).execute(params)

    await expect(promise).rejects.toBeInstanceOf(ConflictError)
    expect(calls).toEqual([])
  })
})
