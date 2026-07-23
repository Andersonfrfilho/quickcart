/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { CacheProvider } from '@/shared/providers/CacheProvider.interface'
import { redis } from './connection'

export class RedisProvider implements CacheProvider {
  async get(key: string): Promise<string | null> {
    return redis.get(key)
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await redis.set(key, value, 'EX', ttlSeconds)
    } else {
      await redis.set(key, value)
    }
  }

  async setIfNotExists(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await redis.set(key, value, 'EX', ttlSeconds, 'NX')
    return result === 'OK'
  }

  async del(key: string): Promise<void> {
    await redis.del(key)
  }

  async exists(key: string): Promise<boolean> {
    const result = await redis.exists(key)
    return result === 1
  }
}
