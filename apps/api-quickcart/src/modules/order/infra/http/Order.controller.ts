/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { RouteHandler } from '@/infra/http/router'
import { requireAdminToken } from '@/infra/http/middlewares/requireAdminToken'
import { validateBody } from '@/infra/http/middlewares/validateBody'
import { validateQuery } from '@/infra/http/middlewares/validateQuery'
import { ValidationError } from '@/shared/errors/AppError.error'
import { IDEMPOTENCY_KEY_MISSING } from '@/shared/errors/codes'
import type { CreateWebOrderUseCase } from '@/modules/order/application/use-cases/CreateWebOrder.use-case'
import type { GetOrderByShortCodeUseCase } from '@/modules/order/application/use-cases/GetOrderByShortCode.use-case'
import type { ListOrdersUseCase } from '@/modules/order/application/use-cases/ListOrders.use-case'
import type { UpdateOrderStatusUseCase } from '@/modules/order/application/use-cases/UpdateOrderStatus.use-case'
import { createWebOrderBodySchema } from './schemas/CreateWebOrder.schema'
import { getOrderByShortCodeQuerySchema } from './schemas/GetOrderByShortCode.schema'
import { listOrdersQuerySchema } from './schemas/ListOrders.schema'
import { updateOrderStatusBodySchema } from './schemas/UpdateOrderStatus.schema'

type OrderControllerDependencies = {
  readonly createWebOrderUseCase: CreateWebOrderUseCase
  readonly getOrderByShortCodeUseCase: GetOrderByShortCodeUseCase
  readonly listOrdersUseCase: ListOrdersUseCase
  readonly updateOrderStatusUseCase: UpdateOrderStatusUseCase
}

export class OrderController {
  constructor(private readonly dependencies: OrderControllerDependencies) {}

  handleCreate: RouteHandler = async (request, response) => {
    const idempotencyKey = request.headers['idempotency-key']
    if (!idempotencyKey) {
      throw new ValidationError('Header "Idempotency-Key" é obrigatório.', IDEMPOTENCY_KEY_MISSING)
    }

    const input = validateBody(createWebOrderBodySchema, request.body)
    const result = await this.dependencies.createWebOrderUseCase.execute({ idempotencyKey, ...input })
    response.json(201, { data: { ...result.order, items: result.items } })
  }

  handleGetByShortCode: RouteHandler = async (request, response) => {
    const shortCode = request.params[0] ?? ''
    const { phone } = validateQuery(getOrderByShortCodeQuerySchema, request.query)
    const result = await this.dependencies.getOrderByShortCodeUseCase.execute({ shortCode, requesterPhone: phone })
    response.json(200, { data: { ...result.order, items: result.items } })
  }

  handleListAdmin: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const query = validateQuery(listOrdersQuerySchema, request.query)
    const result = await this.dependencies.listOrdersUseCase.execute(query)
    response.json(200, { data: result.items, pagination: { total: result.total, page: result.page, perPage: result.perPage } })
  }

  handleUpdateStatus: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const id = request.params[0] ?? ''
    const { status } = validateBody(updateOrderStatusBodySchema, request.body)
    const result = await this.dependencies.updateOrderStatusUseCase.execute({ orderId: id, status })
    response.json(200, { data: result.order })
  }
}
