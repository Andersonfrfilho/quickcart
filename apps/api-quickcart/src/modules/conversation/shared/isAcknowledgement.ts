/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O "ok" que encerra o assunto, e não começa outro.
 *
 * Existe por um caso real: depois de escolher o produto substituto o cliente respondeu "ok", a
 * sessão estava estacionada em `greeting` desde que a compra fechou, e o bot abriu o menu de boas-
 * vindas — pedindo que ele fizesse o pedido de novo, no meio de um pedido que já estava sendo
 * separado.
 *
 * Casa por mensagem INTEIRA, ao contrário de `isOrderStatusRequest`: aqui o falso positivo é caro.
 * "ok, mas cadê o resto do pedido?" é reclamação, e responder "combinado!" a ela seria encerrar uma
 * conversa que estava começando.
 */

import { normalizeMessageText } from './normalizeMessageText'

const ACKNOWLEDGEMENT_WORDS: ReadonlySet<string> = new Set([
  'ok',
  'okay',
  'oka',
  'blz',
  'beleza',
  'certo',
  'ta bom',
  'tudo bem',
  'tudo certo',
  'perfeito',
  'otimo',
  'show',
  'joia',
  'fechou',
  'combinado',
  'isso',
  'obrigado',
  'obrigada',
  'obg',
  'vlw',
  'valeu',
  'muito obrigado',
  'muito obrigada',
  'agradeco',
  'legal',
  'maravilha',
  'uhum',
  'aham',
])

/**
 * Emoji não sobrevive à normalização (que remove tudo que não é letra, número ou espaço): uma
 * mensagem só de 👍 viraria string vazia e cairia no menu. Por isso é testada antes dela.
 */
const ACKNOWLEDGEMENT_EMOJI_ONLY = /^[\s\u{1F44D}\u{1F44C}\u{1F64F}\u{2764}\u{1F642}\u{1F60A}\u{1F605}\u{2705}\u{1F525}]+$/u

export function isAcknowledgement(text: string): boolean {
  if (ACKNOWLEDGEMENT_EMOJI_ONLY.test(text) && text.trim().length > 0) return true

  const normalized = normalizeMessageText(text)
  if (!normalized) return false

  return ACKNOWLEDGEMENT_WORDS.has(normalized)
}
