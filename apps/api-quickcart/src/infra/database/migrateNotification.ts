/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Migrations do `notification-module`, separadas das do quickcart e de propósito.
 *
 * O módulo tem schema (`pgSchema('notification')`), migrations e journal próprios — ele nunca toca
 * o `public` do host, e o host nunca versiona as tabelas dele. Rodar as duas no mesmo comando
 * misturaria os journals e faria um upgrade do pacote parecer migration do produto.
 *
 * O SQL vem de dentro do pacote publicado (`dist/migrations`), então atualizar a versão do
 * `notification-module` é o que traz migration nova — não há nada a copiar para cá.
 */

import { runNotificationMigrations } from '@adatechnology/notification-module'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

import { db, closeDatabaseConnection } from './connection'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const log = logger.child('MigrateNotification')

runNotificationMigrations({ db, migrate })
  .then(() => log.info('notification_migrations_applied'))
  .then(() => closeDatabaseConnection())
  .then(() => process.exit(0))
  .catch((error) => {
    log.error('notification_migrations_failed', { error: serializeError(error) })
    process.exit(1)
  })
