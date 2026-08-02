/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { z } from 'zod'

/**
 * `unavailable` explícito em vez de duas rotas (marcar/desmarcar).
 *
 * Desmarcar é correção de engano de quem separa, e acontece: a pessoa não achou, marcou, e o produto
 * estava em outra gôndola. Um verbo só, com o estado desejado no corpo, é idempotente — dois toques no
 * mesmo botão não deixam o pedido em estado imprevisível.
 */
export const setOrderItemUnavailableBodySchema = z.object({
  unavailable: z.boolean(),
})
