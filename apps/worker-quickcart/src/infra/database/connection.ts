/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Pool próprio do worker — migrações continuam responsabilidade exclusiva da api-quickcart,
 * este processo nunca chama migrate(). O schema local espelha apenas as tabelas que os
 * processors precisam ler (customers, orders, order_items) — o worker nunca escreve catálogo.
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'
import * as schema from './schema'

const isProduction = environment.NODE_ENV === 'production'
const dbLog = logger.child('Database')

const pool = new Pool({
  connectionString: environment.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  min: 1,
  max: 10,
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
