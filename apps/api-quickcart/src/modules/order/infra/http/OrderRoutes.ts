/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { Router } from '@/infra/http/router'
import type { OrderController } from './Order.controller'

type RegisterOrderRoutesParams = {
  readonly router: Router
  readonly orderController: OrderController
}

export function registerOrderRoutes(params: RegisterOrderRoutesParams): void {
  const { router, orderController } = params

  router.post('/v1/orders', orderController.handleCreate)
  router.get('/v1/orders/:shortCode', orderController.handleGetByShortCode)

  router.get('/v1/admin/orders', orderController.handleListAdmin)
  // Antes do `:id/status` não faz diferença aqui (métodos diferentes), mas mantém os dois juntos para
  // quem lê a lista de rotas ver que o detalhe e a transição são da mesma tela.
  router.get('/v1/admin/orders/:id', orderController.handleGetAdminDetail)
  router.patch('/v1/admin/orders/:id/status', orderController.handleUpdateStatus)
  // Item em falta: descoberto na separação, muda o total e avisa o cliente.
  router.patch('/v1/admin/orders/:id/items/:itemId/unavailable', orderController.handleSetItemUnavailable)
  // Aviso das faltas: uma mensagem com todas, quando quem separa termina de conferir.
  router.post('/v1/admin/orders/:id/unavailable-items/notify', orderController.handleNotifyUnavailableItems)
}
