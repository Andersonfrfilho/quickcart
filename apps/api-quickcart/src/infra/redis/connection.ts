/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import Redis from 'ioredis'
import { logger } from '@/shared/logger'
import { environment } from '@/infra/config/environment'

const log = logger.child('Redis')

// Conexão de cache/idempotência (retries curtos — não é a conexão do BullMQ, ver infra/queue/connection.ts).
export const redis = new Redis(environment.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
})

export async function checkRedisConnection(): Promise<void> {
  await redis.connect()
  await redis.ping()
  log.info('connected')
}

export async function pingRedis(): Promise<boolean> {
  try {
    const response = await redis.ping()
    return response === 'PONG'
  } catch (error) {
    log.warn('ping_failed', { error: String(error) })
    return false
  }
}
