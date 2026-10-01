/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import {
  CEP_PATTERN,
  EMAIL_PATTERN,
  PHONE_PATTERN,
  REDACTED_CEP,
  REDACTED_EMAIL,
  REDACTED_PHONE,
} from './pii.constant'

/**
 * Erro de provedor externo costuma carregar dado do cliente na mensagem (a URL do fetch com o
 * CEP, o destinatário do e-mail, o telefone na resposta da Meta). A redação fica aqui, no ponto
 * central, e não em cada call site (security.md §1). Ordem importa: e-mail antes dos números.
 */
export function redactPii(text: string): string {
  return text
    .replace(EMAIL_PATTERN, REDACTED_EMAIL)
    .replace(PHONE_PATTERN, REDACTED_PHONE)
    .replace(CEP_PATTERN, REDACTED_CEP)
}

/**
 * Node wraps multi-address connection failures (e.g. "localhost" resolving to both
 * ::1 and 127.0.0.1) in an AggregateError whose top-level .message is empty — the
 * real reason lives in .errors. Fall back to .name when .message is empty for any Error.
 */
export function serializeError(error: unknown): string {
  return redactPii(describeError(error))
}

function describeError(error: unknown): string {
  if (error instanceof AggregateError) {
    return error.errors.map((nested) => describeError(nested)).join('; ') || error.message || error.name
  }
  if (error instanceof Error) {
    return error.message || error.name
  }
  return String(error)
}
