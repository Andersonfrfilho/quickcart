/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Janela fixa por chave em Redis: `INCR` conta, o primeiro da janela arma o `EXPIRE`. É
 * fail-open de propósito — se o Redis cair, a rota protegida continua respondendo (a cotação não
 * pode parar a loja) e só um `warn` registra a falha.
 */

import type { RouteHandler } from '@/infra/http/router'
import { logger } from '@/shared/logger'
import { TooManyRequestsError } from '@/shared/errors/AppError.error'

import { resolveClientIp } from './resolveClientIp'
import {
  RATE_LIMIT_EXCEEDED_MESSAGE,
  RATE_LIMIT_KEY_PREFIX,
  RATE_LIMIT_STORE_FAILED_LOG_EVENT,
} from './rateLimit.constant'

const log = logger.child('RateLimit')

export type RateLimitCounter = {
  readonly count: number
  readonly ttlSeconds: number
}

/** Porta do contador; a implementação de produção é `RedisRateLimitStore`. */
export type RateLimitStore = {
  increment(key: string, windowSeconds: number): Promise<RateLimitCounter>
}

export type FixedWindowRateLimiterParams = {
  readonly store: RateLimitStore
  /** Separa as janelas de rotas diferentes no mesmo Redis. */
  readonly scope: string
  readonly limit: number
  readonly windowSeconds: number
}

export class FixedWindowRateLimiter {
  constructor(private readonly params: FixedWindowRateLimiterParams) {}

  /** Envolve um handler: acima do limite lança `TooManyRequestsError` (429 + Retry-After no router). */
  protect(handler: RouteHandler): RouteHandler {
    return async (request, response) => {
      await this.consume(resolveClientIp(request.headers))
      await handler(request, response)
    }
  }

  private async consume(clientIp: string): Promise<void> {
    const { store, scope, limit, windowSeconds } = this.params
    let counter: RateLimitCounter
    try {
      counter = await store.increment(`${RATE_LIMIT_KEY_PREFIX}:${scope}:${clientIp}`, windowSeconds)
    } catch (error) {
      // Sem IP no log: é dado pessoal.
      log.warn(RATE_LIMIT_STORE_FAILED_LOG_EVENT, { scope, message: String(error) })
      return
    }
    if (counter.count <= limit) return
    throw new TooManyRequestsError(RATE_LIMIT_EXCEEDED_MESSAGE, Math.max(counter.ttlSeconds, 1))
  }
}
