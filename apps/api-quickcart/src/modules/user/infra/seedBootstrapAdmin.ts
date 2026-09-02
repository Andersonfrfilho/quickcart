/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O primeiro administrador, sem o qual a instalação não tem por onde entrar: com o banco vazio, a
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

const log = logger.child('BootstrapAdmin')

export async function seedBootstrapAdmin(params: { readonly userModule: UserModule }): Promise<void> {
  const email = environment.BOOTSTRAP_ADMIN_EMAIL
  const password = environment.BOOTSTRAP_ADMIN_PASSWORD

  if (!email || !password) {
    log.info('bootstrap_admin_skipped')
    return
  }

  try {
    const profile = await params.userModule.useCases.createUser.execute({
      email,
      password,
      name: environment.BOOTSTRAP_ADMIN_NAME,
      role: QUICKCART_ROLE.ADMIN,
    })
    // Sem e-mail no log: é dado pessoal, e o id opaco é o que serve para rastrear (security.md §1).
    log.info('bootstrap_admin_created', { userId: profile.id })
  } catch (error) {
    // Já existe é o caso NORMAL a partir do segundo boot — a semeadura é idempotente por isto.
    if (error instanceof EmailAlreadyExistsError) {
      log.info('bootstrap_admin_already_exists')
      return
    }
    throw error
  }
}
