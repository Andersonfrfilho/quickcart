/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Interface, e não o módulo direto, porque `UpdateOrderStatus` é regra de pedido e não deve
 * conhecer canal, template nem fila (`code-standart.md` §6). Antes dependia de `JobQueue` — mesma
 * ideia, só que a fila era detalhe de infraestrutura exposto no use-case.
 */

export type NotifyStatusChangedParams = {
  readonly orderId: string
  /** `null` no pedido web sem cadastro: não há a quem avisar, e o notificador ignora. */
  readonly customerId: string | null
  readonly shortCode: string | null
  readonly status: string
}

export interface OrderStatusNotifier {
  notifyStatusChanged(params: NotifyStatusChangedParams): Promise<void>
}
