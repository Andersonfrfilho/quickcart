/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Os usuários que a instalação precisa ter para funcionar: o primeiro administrador, sem o qual não
 * há por onde entrar: com o banco vazio, a
 * tela de login não tem resposta possível e não existe rota pública para criar o primeiro usuário.
 *
 * Roda o caso de uso do pacote, nunca um `INSERT` (code-standart §5) — é o que garante que a senha
 * passe pelo mesmo hash do login e que o usuário nasça idêntico a um criado pela tela.
 */

import { EmailAlreadyExistsError } from '@adatechnology/user-contracts'
import type { UserModule } from '@adatechnology/user-module'

import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'
import { QUICKCART_ROLE } from '@/modules/user/shared/User.constant'
import type { QuickCartRole } from '@/modules/user/shared/User.constant'

const log = logger.child('BootstrapAdmin')

type SeedOneParams = {
  readonly userModule: UserModule
  readonly email: string | undefined
  readonly password: string | undefined
  readonly name: string
  readonly role: QuickCartRole
}

async function seedOne(params: SeedOneParams): Promise<void> {
  if (!params.email || !params.password) {
    log.info('bootstrap_skipped', { role: params.role })
    return
  }

  try {
    const profile = await params.userModule.useCases.createUser.execute({
      email: params.email,
      password: params.password,
      name: params.name,
      role: params.role,
    })
    // Sem e-mail no log: é dado pessoal, e o id opaco é o que serve para rastrear (security.md §1).
    log.info('bootstrap_user_created', { userId: profile.id, role: params.role })
  } catch (error) {
    // Já existe é o caso NORMAL a partir do segundo boot — a semeadura é idempotente por isto.
    if (error instanceof EmailAlreadyExistsError) {
      log.info('bootstrap_user_already_exists', { role: params.role })
      return
    }
    throw error
  }
}

export async function seedBootstrapUsers(params: { readonly userModule: UserModule }): Promise<void> {
  await seedOne({
    userModule: params.userModule,
    email: environment.BOOTSTRAP_ADMIN_EMAIL,
    password: environment.BOOTSTRAP_ADMIN_PASSWORD,
    name: environment.BOOTSTRAP_ADMIN_NAME,
    role: QUICKCART_ROLE.ADMIN,
  })

  await seedOne({
    userModule: params.userModule,
    email: environment.BOOTSTRAP_SERVICE_EMAIL,
    password: environment.BOOTSTRAP_SERVICE_PASSWORD,
    name: 'Worker',
    role: QUICKCART_ROLE.SERVICE,
  })
}
