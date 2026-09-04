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
  /** Nome informado por uma PESSOA. Sobrescreve o que houver. */
  readonly name?: string | undefined
  /**
   * Nome que veio do perfil do WhatsApp. Preenche quando não há nome, e NUNCA sobrescreve.
   *
   * Campo separado de `name` de propósito: um booleano `overwrite` deixaria os dois call sites
   * decidirem a mesma coisa de jeitos diferentes. O atendente que corrige "Joana" para "Joana —
   * Padaria Central" não pode ver a correção sumir na próxima mensagem que a cliente mandar.
   */
  readonly fallbackName?: string | undefined
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
