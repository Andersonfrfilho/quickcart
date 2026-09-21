/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O cadastro do cliente final na loja.
 *
 * O `user-module` não publica auto-cadastro — `POST /admin/users` é escopo administrativo, e com
 * razão: papel é decisão do produto, e um cadastro público que aceitasse `role` do corpo deixaria
 * qualquer visitante virar admin. Aqui o papel é FIXO em `cliente` e nunca vem da requisição.
 *
 * O telefone é o que liga o cadastro ao histórico: quem já comprou pelo WhatsApp tem uma linha em
 * `customers` com pedidos, e o cadastro ADOTA essa linha em vez de criar outra.
 */

import type { UserModule } from '@adatechnology/user-module'

import type { CustomerRepositoryInterface } from '@/modules/webhook/domain/CustomerRepository.interface'
import { QUICKCART_ROLE } from '@/modules/user/shared/User.constant'
import { ConflictError } from '@/shared/errors/AppError.error'
import { CUSTOMER_PHONE_ALREADY_REGISTERED } from '@/shared/errors/codes'

import type { RegisterCustomerParams, RegisterCustomerResult } from '../types/RegisterCustomer.types'

type RegisterCustomerUseCaseDependencies = {
  readonly userModule: UserModule
  readonly customerRepository: CustomerRepositoryInterface
}

export class RegisterCustomerUseCase {
  constructor(private readonly dependencies: RegisterCustomerUseCaseDependencies) {}

  async execute(params: RegisterCustomerParams): Promise<RegisterCustomerResult> {
    const existing = await this.dependencies.customerRepository.findByPhone(params.phone)

    /*
     * Telefone já ligado a OUTRO login: recusar é o certo, e o índice único faria isso de qualquer
     * forma — mas com uma violação de constraint em vez de uma mensagem que a tela sabe mostrar.
     */
    if (existing?.userId) {
      throw new ConflictError('Phone already linked to an account', CUSTOMER_PHONE_ALREADY_REGISTERED)
    }

    // O usuário primeiro: se o e-mail já existe, o pacote recusa e nada foi escrito em `customers`.
    const profile = await this.dependencies.userModule.useCases.createUser.execute({
      email: params.email,
      name: params.name,
      password: params.password,
      role: QUICKCART_ROLE.CUSTOMER,
    })

    const customer =
      existing ?? (await this.dependencies.customerRepository.upsertByPhone({ phone: params.phone, name: params.name }))

    const linked = await this.dependencies.customerRepository.linkToUser({
      customerId: customer.id,
      userId: profile.id,
    })

    return { userId: profile.id, customerId: linked.id }
  }
}
