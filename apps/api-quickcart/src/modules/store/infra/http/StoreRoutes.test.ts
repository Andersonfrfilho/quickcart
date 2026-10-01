/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { describe, expect, it } from 'bun:test'

import { Router, type RouteHandler } from '@/infra/http/router'
import {
  FixedWindowRateLimiter,
  type RateLimitCounter,
  type RateLimitStore,
} from '@/infra/http/rate-limit/FixedWindowRateLimiter'
import {
  STORE_REGISTER_RATE_LIMIT_PER_WINDOW,
  STORE_REGISTER_RATE_LIMIT_WINDOW_SECONDS,
} from '@/modules/store/shared/Store.constant'

import { registerStoreRoutes } from './StoreRoutes'

class InMemoryRateLimitStore implements RateLimitStore {
  private readonly counts = new Map<string, number>()

  async increment(key: string, windowSeconds: number): Promise<RateLimitCounter> {
    const count = (this.counts.get(key) ?? 0) + 1
    this.counts.set(key, count)
    return { count, ttlSeconds: windowSeconds }
  }
}

const respondCreated: RouteHandler = (_request, response) => response.json(201, { data: {} })

function buildRouter(): Router {
  const store = new InMemoryRateLimitStore()
  const router = new Router()
  registerStoreRoutes({
    router,
    storeController: {
      handleRegister: respondCreated,
      handleListMyOrders: respondCreated,
      handleGetCheckoutQuote: respondCreated,
    },
    checkoutQuoteRateLimiter: new FixedWindowRateLimiter({ store, scope: 'checkout-quote', limit: 60, windowSeconds: 60 }),
    registerRateLimiter: new FixedWindowRateLimiter({
      store,
      scope: 'store-register',
      limit: STORE_REGISTER_RATE_LIMIT_PER_WINDOW,
      windowSeconds: STORE_REGISTER_RATE_LIMIT_WINDOW_SECONDS,
    }),
  })
  return router
}

function registerRequest(clientIp: string): Request {
  return new Request('http://localhost/v1/store/register', {
    method: 'POST',
    body: '{}',
    headers: { 'x-real-ip': clientIp },
  })
}

describe('POST /v1/store/register — rate limit por IP', () => {
  it('passa até o limite e responde 429 com Retry-After acima dele', async () => {
    const router = buildRouter()

    for (let attempt = 0; attempt < STORE_REGISTER_RATE_LIMIT_PER_WINDOW; attempt += 1) {
      expect((await router.handle(registerRequest('203.0.113.9'))).status).toBe(201)
    }
    const blocked = await router.handle(registerRequest('203.0.113.9'))

    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBe(String(STORE_REGISTER_RATE_LIMIT_WINDOW_SECONDS))
    expect((await router.handle(registerRequest('198.51.100.7'))).status).toBe(201)
  })
})
