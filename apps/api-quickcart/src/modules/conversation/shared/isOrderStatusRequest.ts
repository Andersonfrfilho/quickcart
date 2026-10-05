/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Quem está perguntando onde está o pedido que já fechou.
 *
 * Casa por trecho, e não por mensagem inteira como `isCancelOrderRequest`: a pergunta vem embrulhada
 * ("oi, bom dia, cadê meu pedido?") e exigir a frase exata deixaria de fora quase toda forma real de
 * perguntar. O custo de um falso positivo aqui é baixo de propósito — a resposta errada é mostrar o
 * status de um pedido que a pessoa não perguntou, que é informação verdadeira e do assunto.
 *
 * Só é consultado DEPOIS de `isCancelOrderRequest` e `isHumanHandoffRequest` no GlobalHandler, e é
 * por isso que "cancelar o pedido" não chega aqui para ser lido como pergunta de status.
 */

import { normalizeMessageText } from './normalizeMessageText'

/**
 * Trechos que, aparecendo em qualquer lugar da mensagem, a tornam pergunta de status.
 *
 * "pedido" e "entrega" sozinhos ficam fora: são as palavras mais comuns do vocabulário da loja e
 * apareceriam em "quero fazer um pedido", que é o oposto do que esta função reconhece.
 */
const ORDER_STATUS_PHRASES = [
  'cade',
  'onde esta',
  'onde ta',
  'ja saiu',
  'ja esta pronto',
  'esta pronto',
  'ficou pronto',
  'quando chega',
  'quanto tempo',
  'que horas chega',
  'status',
  'andamento',
  'acompanhar',
  'previsao',
  'ainda nao chegou',
  'nao chegou',
  'esta demorando',
  'demorando',
  'saiu para entrega',
] as const

export function isOrderStatusRequest(text: string): boolean {
  const normalized = normalizeMessageText(text)
  if (!normalized) return false

  return ORDER_STATUS_PHRASES.some((phrase) => normalized.includes(phrase))
}
