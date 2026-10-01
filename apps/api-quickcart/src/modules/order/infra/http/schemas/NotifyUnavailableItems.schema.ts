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
 * Obrigatório, sem padrão.
 *
 * Um `.default(true)` faria um cliente antigo parar pedidos sem querer, e um `.default(false)` mandaria
 * recado sem perguntar quando a intenção era perguntar. Os dois caminhos falam com o cliente e mudam o
 * andamento do pedido — a escolha é sempre explícita de quem clicou.
 */
export const notifyUnavailableItemsBodySchema = z.object({
  requiresCustomerApproval: z.boolean(),
})
