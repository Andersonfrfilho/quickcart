/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Casamento por mensagem inteira, nunca substring (spec §3.5, T3.1): "o atendente de ontem
 * errou meu pedido" pede ajuda sobre um pedido, não transferência. A frase inteira ser uma das
 * expressões cobre "atendente"/"humano"/"pessoa" isolados; o prefixo "falar com" cobre pedidos
 * educados ("quero falar com um atendente") sem abrir a porta para qualquer menção ao assunto.
 */

import { HUMAN_HANDOFF_PHRASES } from '@/modules/conversation/shared/Messages.constant'

/** Base que pode seguir um dos prefixos de pedido, com ou sem artigo. */
const HANDOFF_BASE_EXPRESSIONS = ['atendente', 'humano', 'pessoa', 'alguem'] as const

/** Do mais específico ("preciso falar com") para o mais curto ("falar com"), mas a ordem não importa: só um pode casar por mensagem. */
const HANDOFF_REQUEST_PREFIXES = ['quero falar com', 'preciso falar com', 'falar com'] as const

const HANDOFF_ARTICLES = ['um', 'uma', 'o', 'a'] as const

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchesRequestPrefix(normalized: string): boolean {
  for (const prefix of HANDOFF_REQUEST_PREFIXES) {
    if (!normalized.startsWith(`${prefix} `)) continue

    let rest = normalized.slice(prefix.length).trim()
    const [firstWord] = rest.split(' ')
    if (firstWord && (HANDOFF_ARTICLES as readonly string[]).includes(firstWord)) {
      rest = rest.slice(firstWord.length).trim()
    }

    if ((HANDOFF_BASE_EXPRESSIONS as readonly string[]).includes(rest)) return true
  }

  return false
}

export function isHumanHandoffRequest(text: string): boolean {
  const normalized = normalize(text)
  if (!normalized) return false

  const normalizedPhrases = HUMAN_HANDOFF_PHRASES.map(normalize)
  if (normalizedPhrases.includes(normalized)) return true

  return matchesRequestPrefix(normalized)
}
