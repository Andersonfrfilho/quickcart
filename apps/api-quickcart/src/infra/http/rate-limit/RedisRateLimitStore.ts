/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type Redis from 'ioredis'

import type { RateLimitCounter, RateLimitStore } from './FixedWindowRateLimiter'

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly redis: Redis) {}

  async increment(key: string, windowSeconds: number): Promise<RateLimitCounter> {
    const results = await this.redis.multi().incr(key).ttl(key).exec()
    const count = Number(results?.[0]?.[1] ?? 0)
    let ttlSeconds = Number(results?.[1]?.[1] ?? -1)
    // TTL -1: chave recém-criada nesta janela (ou que perdeu o expire) — arma a janela agora.
    if (ttlSeconds < 0) {
      await this.redis.expire(key, windowSeconds)
      ttlSeconds = windowSeconds
    }
    return { count, ttlSeconds }
  }
}
