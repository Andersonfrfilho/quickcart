/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O IP do cliente vem de `X-Real-IP`, que o edge do Railway PREENCHE com o endereço remoto de quem
 * conectou (docs.railway.com, Public Networking › Specs & Limits).
 *
 * `X-Forwarded-For` NÃO serve de fonte: verificado em staging em 2026-09-22, o valor que o cliente
 * manda chega intacto ao fim da lista — com o último salto como chave, 65 requisições com um IP
 * forjado diferente cada uma passaram todas, e sem forjar a 53ª já levou 429. Qualquer um contornava
 * o limite trocando um header.
 *
 * O último salto do `X-Forwarded-For` fica só como reserva para quando não há edge na frente
 * (desenvolvimento local), onde não existe `X-Real-IP` e ninguém de fora alcança a porta.
 */

import { RATE_LIMIT_UNKNOWN_CLIENT } from './rateLimit.constant'

export function resolveClientIp(headers: Readonly<Record<string, string>>): string {
  const realIp = headers['x-real-ip']?.trim()
  if (realIp) return realIp

  const lastHop = headers['x-forwarded-for']
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .at(-1)
  return lastHop ?? RATE_LIMIT_UNKNOWN_CLIENT
}
