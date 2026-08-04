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

// Booleano explícito, não toggle: dois toques simultâneos em aparelhos diferentes convergem para o
// mesmo estado, em vez de um desfazer o outro.
export const setOrderItemPickedBodySchema = z.object({
  picked: z.boolean(),
})
