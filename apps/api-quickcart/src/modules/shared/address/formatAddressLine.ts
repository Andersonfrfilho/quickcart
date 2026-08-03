/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Uma linha de endereço para o CLIENTE ler, no resumo de confirmação e na memória de "repetir a
 * última compra". Sem isto, `String(addressEstruturado)` virava `"[object Object]"` no WhatsApp
 * assim que o checkout passou a guardar objeto em vez de texto (T2.2).
 */

type StructuredAddressLike = {
  readonly street: unknown
  readonly number: unknown
  readonly complement?: unknown
  readonly neighborhood: unknown
  readonly city: unknown
  readonly state: unknown
}

function isStructuredAddressLike(address: unknown): address is StructuredAddressLike {
  if (!address || typeof address !== 'object') return false
  const candidate = address as Record<string, unknown>
  return (
    typeof candidate.street === 'string' &&
    typeof candidate.number === 'string' &&
    typeof candidate.neighborhood === 'string' &&
    typeof candidate.city === 'string' &&
    typeof candidate.state === 'string'
  )
}

export function formatAddressLine(address: unknown): string | undefined {
  if (isStructuredAddressLike(address)) {
    const complement = typeof address.complement === 'string' && address.complement ? ` - ${address.complement}` : ''
    return `${String(address.street)}, ${String(address.number)}${complement} — ${String(address.neighborhood)}, ${String(address.city)}/${String(address.state)}`
  }
  if (typeof address === 'string' && address.trim().length > 0) return address.trim()
  return undefined
}
