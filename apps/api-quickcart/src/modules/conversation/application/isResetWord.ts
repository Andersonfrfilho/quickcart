/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Par do `isExitWord`, e com a mesma regra de casamento: mensagem inteira, nunca pedaço. "reset" é
 * palavra que aparece dentro de frase de gente ("deu reset no meu celular") e o comando apaga o
 * cadastro inteiro — casar por substring entregaria isso a quem só estava contando um caso.
 */

import { GLOBAL_TRIGGER } from '@/modules/conversation/shared/Messages.constant'

export function isResetWord(body: string): boolean {
  const normalized = body.trim().toLowerCase()
  return (GLOBAL_TRIGGER.RESET_WORDS as readonly string[]).includes(normalized)
}
