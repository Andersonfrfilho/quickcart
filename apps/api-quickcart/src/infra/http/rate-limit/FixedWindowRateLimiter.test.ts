/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Limite por IP em janela fixa: acima do limite 429 + Retry-After; IP lido do último salto do
 * X-Forwarded-For (o que o edge do Railway acrescenta); Redis fora do ar não derruba a rota.
 */

import { describe, expect, it } from 'bun:test'

import { Router } from '@/infra/http/router'

import { FixedWindowRateLimiter, type RateLimitCounter, type RateLimitStore } from './FixedWindowRateLimiter'
import { resolveClientIp } from './resolveClientIp'

const WINDOW_SECONDS = 60

class InMemoryRateLimitStore implements RateLimitStore {
  readonly counts = new Map<string, number>()

  async increment(key: string, windowSeconds: number): Promise<RateLimitCounter> {
    const count = (this.counts.get(key) ?? 0) + 1
    this.counts.set(key, count)
    return { count, ttlSeconds: windowSeconds }
  }
}

class FailingRateLimitStore implements RateLimitStore {
  async increment(): Promise<RateLimitCounter> {
    throw new Error('redis down')
  }
}

function buildRouter(store: RateLimitStore, limit: number): Router {
  const limiter = new FixedWindowRateLimiter({ store, scope: 'test', limit, windowSeconds: WINDOW_SECONDS })
  const router = new Router()
  router.post('/quote', limiter.protect((_request, response) => response.json(200, { data: 'ok' })))
  return router
}

function quoteRequest(forwardedFor: string): Request {
  return new Request('http://localhost/quote', { method: 'POST', body: '{}', headers: { 'x-forwarded-for': forwardedFor } })
}

describe('FixedWindowRateLimiter', () => {
  it('acima do limite responde 429 com Retry-After', async () => {
    const router = buildRouter(new InMemoryRateLimitStore(), 2)

    expect((await router.handle(quoteRequest('203.0.113.9'))).status).toBe(200)
    expect((await router.handle(quoteRequest('203.0.113.9'))).status).toBe(200)
    const blocked = await router.handle(quoteRequest('203.0.113.9'))

    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBe(String(WINDOW_SECONDS))
  })

  it('conta por IP: outro cliente não é afetado', async () => {
    const router = buildRouter(new InMemoryRateLimitStore(), 1)

    await router.handle(quoteRequest('203.0.113.9'))

    expect((await router.handle(quoteRequest('198.51.100.7'))).status).toBe(200)
  })

  it('forjar o início do X-Forwarded-For não escapa do limite', async () => {
    const router = buildRouter(new InMemoryRateLimitStore(), 1)

    await router.handle(quoteRequest('1.1.1.1, 203.0.113.9'))

    expect((await router.handle(quoteRequest('2.2.2.2, 203.0.113.9'))).status).toBe(429)
  })

  it('Redis fora do ar: fail-open, a rota responde', async () => {
    const router = buildRouter(new FailingRateLimitStore(), 1)

    expect((await router.handle(quoteRequest('203.0.113.9'))).status).toBe(200)
    expect((await router.handle(quoteRequest('203.0.113.9'))).status).toBe(200)
  })
})

describe('resolveClientIp', () => {
  it('usa o último salto do X-Forwarded-For', () => {
    expect(resolveClientIp({ 'x-forwarded-for': '10.0.0.1, 203.0.113.9' })).toBe('203.0.113.9')
  })

  it('sem X-Forwarded-For cai em X-Real-IP e depois em unknown', () => {
    expect(resolveClientIp({ 'x-real-ip': '203.0.113.9' })).toBe('203.0.113.9')
    expect(resolveClientIp({})).toBe('unknown')
  })
})
