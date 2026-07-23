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
  const migrationsFolder = path.resolve(import.meta.dir, '../../../drizzle/migrations')
  dbLog.info('running_migrations')
  await migrate(db, { migrationsFolder })
  dbLog.info('migrations_completed')
}
