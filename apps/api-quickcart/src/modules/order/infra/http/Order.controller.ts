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
import { allowedNextStatuses } from '@/modules/order/domain/orderStatusFlow'
import type { GetAdminOrderDetailUseCase } from '@/modules/order/application/use-cases/GetAdminOrderDetail.use-case'
import type { SetOrderItemUnavailableUseCase } from '@/modules/order/application/use-cases/SetOrderItemUnavailable.use-case'
import type { NotifyUnavailableItemsUseCase } from '@/modules/order/application/use-cases/NotifyUnavailableItems.use-case'
import { setOrderItemUnavailableBodySchema } from '@/modules/order/infra/http/schemas/SetOrderItemUnavailable.schema'
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
  readonly getAdminOrderDetailUseCase: GetAdminOrderDetailUseCase
  readonly setOrderItemUnavailableUseCase: SetOrderItemUnavailableUseCase
  readonly notifyUnavailableItemsUseCase: NotifyUnavailableItemsUseCase
}

/**
 * Acrescenta ao pedido os próximos passos válidos.
 *
 * A tela precisa desenhar botões, e a única forma de não existirem duas esteiras (uma no servidor, outra no
 * front) é o servidor dizer quais são. Antes o front tinha o mapa próprio, e qualquer mudança de fluxo
 * precisava ser feita nos dois lugares — divergir era questão de tempo.
 */
function withAllowedTransitions<TOrder extends { readonly status: string; readonly deliveryType: string }>(
  order: TOrder,
): TOrder & { readonly allowedNextStatuses: readonly string[] } {
  return {
    ...order,
    allowedNextStatuses: allowedNextStatuses({ status: order.status, deliveryType: order.deliveryType }),
  }
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
    response.json(200, {
      data: result.items.map(withAllowedTransitions),
      pagination: { total: result.total, page: result.page, perPage: result.perPage },
    })
  }

  handleGetAdminDetail: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const id = request.params[0] ?? ''
    const detail = await this.dependencies.getAdminOrderDetailUseCase.execute({ orderId: id })
    response.json(200, { data: { ...withAllowedTransitions(detail.order), items: detail.items } })
  }

  handleSetItemUnavailable: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    // Dois parâmetros na ordem em que aparecem na rota: pedido, depois item.
    const orderId = request.params[0] ?? ''
    const itemId = request.params[1] ?? ''
    const { unavailable } = validateBody(setOrderItemUnavailableBodySchema, request.body)

    const detail = await this.dependencies.setOrderItemUnavailableUseCase.execute({ orderId, itemId, unavailable })
    response.json(200, { data: { ...withAllowedTransitions(detail.order), items: detail.items } })
  }

  handleNotifyUnavailableItems: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const orderId = request.params[0] ?? ''
    const result = await this.dependencies.notifyUnavailableItemsUseCase.execute({ orderId })

    // `notifiedCount` no corpo para a tela dizer o que aconteceu: zero significa que não havia nada novo,
    // e um "avisado!" nesse caso seria mentira.
    response.json(200, {
      data: { ...withAllowedTransitions(result.detail.order), items: result.detail.items },
      meta: { notifiedCount: result.notifiedCount },
    })
  }

  handleUpdateStatus: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const id = request.params[0] ?? ''
    const { status } = validateBody(updateOrderStatusBodySchema, request.body)
    const result = await this.dependencies.updateOrderStatusUseCase.execute({ orderId: id, status })
    response.json(200, { data: result.order })
  }
}
