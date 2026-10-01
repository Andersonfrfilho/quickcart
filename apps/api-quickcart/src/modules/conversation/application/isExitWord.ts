/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * "sair"/"cancelar" em qualquer ponto da conversa. Um lugar só porque duas camadas precisam da mesma
 * resposta: o grafo, que tem a primeira palavra, e o GlobalHandler, que responde a despedida.
 */

import { GLOBAL_TRIGGER } from '@/modules/conversation/shared/Messages.constant'

export function isExitWord(body: string): boolean {
  const normalized = body.trim().toLowerCase()
  return (GLOBAL_TRIGGER.EXIT_WORDS as readonly string[]).includes(normalized)
}
