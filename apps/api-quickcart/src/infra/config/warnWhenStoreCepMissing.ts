/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Sem `STORE_CEP` não há de onde medir a distância: a loja só faz retirada (spec §3.1). Não derruba o
 * boot — staging sem CEP ainda vende — mas avisa, senão "a entrega sumiu" chega como bug do bot.
 */

import { logger } from '@/shared/logger'

export const STORE_CEP_MISSING_EVENT = 'store_cep_missing_delivery_disabled'

const bootLog = logger.child('Bootstrap')

export function warnWhenStoreCepMissing(storeCep: string | undefined): void {
  if (storeCep) return
  bootLog.warn(STORE_CEP_MISSING_EVENT, { deliveryAvailable: false })
}
