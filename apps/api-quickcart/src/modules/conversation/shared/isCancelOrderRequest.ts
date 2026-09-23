/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Quem pede para cancelar O PEDIDO, e não para sair da conversa.
 *
 * "cancelar" sozinho já é palavra de saída (`isExitWord`) e continua sendo: desfazer uma compra
 * fechada é grave demais para ser disparado por uma palavra que o cliente usa para escapar de um
 * menu. Por isso o casamento exige o objeto — "cancelar o pedido", "quero cancelar minha compra" —
 * e é por mensagem inteira, nunca substring: "por que o pedido foi cancelado?" é pergunta sobre um
 * cancelamento que já aconteceu, e responder cancelando de novo seria o pior entendimento possível.
 */

/** O objeto que precisa estar dito para a intenção ser de pedido, e não de sair da conversa. */
const CANCEL_OBJECTS = ['pedido', 'compra', 'a compra', 'o pedido', 'minha compra', 'meu pedido'] as const

const CANCEL_VERBS = ['cancelar', 'quero cancelar', 'queria cancelar', 'gostaria de cancelar', 'preciso cancelar'] as const

const CANCEL_ARTICLES = ['o', 'a', 'meu', 'minha'] as const

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isCancelOrderRequest(text: string): boolean {
  const normalized = normalize(text)
  if (!normalized) return false

  for (const verb of CANCEL_VERBS) {
    if (!normalized.startsWith(`${verb} `)) continue

    let rest = normalized.slice(verb.length).trim()
    const [firstWord] = rest.split(' ')
    if (firstWord && (CANCEL_ARTICLES as readonly string[]).includes(firstWord)) {
      rest = rest.slice(firstWord.length).trim()
    }

    if ((CANCEL_OBJECTS as readonly string[]).includes(rest)) return true
  }

  return false
}
