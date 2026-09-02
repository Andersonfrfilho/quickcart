/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { runNotificationMigrations } from '@adatechnology/notification-module'
import { runUserMigrations } from '@adatechnology/user-module'
import { runMetaWhatsAppMigrations } from '@adatechnology/meta-whatsapp-module'
import { Pool } from 'pg'
import path from 'node:path'
import { logger } from '@/shared/logger'
import { environment } from '@/infra/config/environment'
import * as schema from './schema'

const isProduction = environment.NODE_ENV === 'production'
const dbLog = logger.child('Database')

const pool = new Pool({
  connectionString: environment.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  min: 2,
  max: 20,
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 5_000,
  keepAlive: true,
})

pool.on('error', (error) => dbLog.error('pool_error', { error: String(error) }))

export const db = drizzle(pool, { schema })

export async function checkDatabaseConnection(): Promise<void> {
  const client = await pool.connect()
  client.release()
  dbLog.info('connected')
}

let isPoolClosed = false

export async function closeDatabaseConnection(): Promise<void> {
  if (isPoolClosed) return
  isPoolClosed = true
  await pool.end()
  dbLog.info('connection_pool_closed')
}

export async function pingDatabase(): Promise<boolean> {
  try {
    await pool.query('SELECT 1')
    return true
  } catch (error) {
    dbLog.warn('ping_failed', { error: String(error) })
    return false
  }
}

export async function runMigrations(): Promise<void> {
  // O módulo vem primeiro porque a migration 0005 daqui copia dados para dentro do schema
  // meta_whatsapp — ele precisa existir antes. As duas cadeias têm journals separados
  // (drizzle.meta_whatsapp_migrations vs __drizzle_migrations), então a ordem é dada aqui,
  // não por numeração.
  dbLog.info('running_meta_whatsapp_migrations')
  await runMetaWhatsAppMigrations({ db, migrate: migrate as never })

  const migrationsFolder = path.resolve(import.meta.dir, '../../../drizzle/migrations')
  dbLog.info('running_migrations')
  await migrate(db, { migrationsFolder })

  /*
   * As migrations dos módulos plugáveis, no boot e não num comando à parte.
   *
   * Cada uma tem schema e journal próprios — `notification`, `user` —, e continuam separadas: o que
   * muda é QUEM as dispara. Havia um `make notification-migrate` e um `make user-migrate` para
   * alguém rodar à mão, e nenhum deploy os chamava: a api subia, `seedBootstrapUsers` procurava
   * `user.users` e o processo morria. Semear no boot e migrar à mão era incoerente.
   *
   * Os alvos do Makefile continuam, para rodar isoladamente em desenvolvimento.
   */
  dbLog.info('running_notification_migrations')
  await runNotificationMigrations({ db, migrate })

  dbLog.info('running_user_migrations')
  await runUserMigrations({ db, migrate })

  dbLog.info('migrations_completed')
}
