/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Troca a senha de um usuário sem passar por e-mail.
 *
 * Existe porque o fluxo normal — "esqueci minha senha" — depende de SMTP, e o `user-module` só
 * publica essas rotas quando há driver de e-mail. Num ambiente sem SMTP não haveria como girar uma
 * senha queimada, e senha queimada tem de girar (`security.md` §4).
 *
 * NÃO escreve o hash à mão: emite um token de redefinição pelos utilitários do pacote e chama o
 * caso de uso de confirmação, que é quem sabe derivar o hash. Reimplementar isso aqui criaria uma
 * segunda forma de gerar senha — e no dia em que o pacote trocasse de algoritmo, a senha escrita
 * por aqui deixaria de autenticar sem ninguém entender por quê.
 *
 * A senha vem de VARIÁVEL DE AMBIENTE, nunca de argumento: argumento aparece em `ps` e no
 * histórico do shell.
 *
 *   NEW_PASSWORD='...' USER_EMAIL='...' bun run src/infra/database/setUserPassword.ts
 */

import { randomUUID } from 'node:crypto'

import { PasswordResetTokenRepository, generateRawToken, hashToken } from '@adatechnology/user-module'

import { getQuickCartUserModule } from '@/modules/user/infra/userModule'
import { db, closeDatabaseConnection } from './connection'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const log = logger.child('SetUserPassword')
const TOKEN_TTL_SECONDS = 60

async function run(): Promise<void> {
  const email = process.env['USER_EMAIL']
  const newPassword = process.env['NEW_PASSWORD']

  if (!email || !newPassword) {
    throw new Error('Informe USER_EMAIL e NEW_PASSWORD como variáveis de ambiente.')
  }

  const userModule = await getQuickCartUserModule()
  const { data: users } = await userModule.useCases.listUsers.execute({ page: 1, perPage: 500 })
  const user = users.find((candidate) => candidate.email === email)
  if (!user) throw new Error('Usuário não encontrado para o e-mail informado.')

  /*
   * Token de vida curtíssima criado só para ser consumido na linha seguinte. Se algo falhar entre
   * a criação e a confirmação, ele expira sozinho em um minuto em vez de ficar válido por aí.
   */
  const rawToken = generateRawToken()
  // Os defaults da tabela (id, createdAt) são do banco; o tipo de insert do Drizzle os exige aqui.
  await new PasswordResetTokenRepository(db).create({
    id: randomUUID(),
    userId: user.id,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000),
    createdAt: new Date(),
    consumedAt: null,
    requestedIp: null,
  })

  await userModule.useCases.confirmPasswordReset.execute({ rawToken, newPassword })

  // Sem e-mail no log: é dado pessoal, e o id opaco é o que serve para rastrear (security.md §1).
  log.info('password_updated', { userId: user.id })
}

run()
  .then(() => closeDatabaseConnection())
  .then(() => process.exit(0))
  .catch((error) => {
    log.error('password_update_failed', { error: serializeError(error) })
    process.exit(1)
  })
