/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O `wamid` da Meta parece opaco e não é: ele é base64 e carrega o telefone do destinatário em
 * claro lá dentro — `wamid.HBgNNTUxNjk5...` decodifica para `...5516993056772...`. Logar o id
 * cru viola a proibição de PII em log (security.md §1) sem que a linha pareça ter telefone algum.
 *
 * O hash preserva o que o log precisa (a mesma mensagem produz sempre a mesma chave, então dá
 * para juntar os vários webhooks de status de um envio só) e descarta o que ele não pode ter.
 * Para achar a linha no banco a partir do log, hasheia-se o `wa_message_id` candidato.
 */

import { createHash } from 'node:crypto'

const HASH_LENGTH = 16

export function hashWaMessageId(waMessageId: string | undefined): string | undefined {
  if (waMessageId === undefined) return undefined

  return createHash('sha256').update(waMessageId).digest('hex').slice(0, HASH_LENGTH)
}
