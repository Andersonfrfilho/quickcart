/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O edge do Railway ACRESCENTA o IP de quem o conectou ao final de `X-Forwarded-For`; o que vem
 * antes é o que o cliente mandou e pode ser forjado. Com exatamente um proxy confiável na frente,
 * o único valor confiável é o último da lista — o primeiro é escolha do atacante.
 */

import { RATE_LIMIT_UNKNOWN_CLIENT } from './rateLimit.constant'

export function resolveClientIp(headers: Readonly<Record<string, string>>): string {
  const forwardedFor = headers['x-forwarded-for']
  const lastHop = forwardedFor?.split(',').map((entry) => entry.trim()).filter(Boolean).at(-1)
  return lastHop ?? headers['x-real-ip'] ?? RATE_LIMIT_UNKNOWN_CLIENT
}
