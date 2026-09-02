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
import { requireSession } from '@/infra/http/middlewares/requireSession'
import { ORDER_NOTIFIERS, ORDER_PICKERS, ORDER_READERS, ORDER_STATUS_WRITERS } from '@/modules/user/shared/User.constant'
import { allowedNextStatuses } from '@/modules/order/domain/orderStatusFlow'
import type { GetAdminOrderDetailUseCase } from '@/modules/order/application/use-cases/GetAdminOrderDetail.use-case'
import type { SetOrderItemUnavailableUseCase } from '@/modules/order/application/use-cases/SetOrderItemUnavailable.use-case'
import type { SetOrderItemPickedUseCase } from '@/modules/order/application/use-cases/SetOrderItemPicked.use-case'
import type { NotifyUnavailableItemsUseCase } from '@/modules/order/application/use-cases/NotifyUnavailableItems.use-case'
import { setOrderItemUnavailableBodySchema } from '@/modules/order/infra/http/schemas/SetOrderItemUnavailable.schema'
import { setOrderItemPickedBodySchema } from '@/modules/order/infra/http/schemas/SetOrderItemPicked.schema'
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
import { CUSTOMER_ONLY } from '@/modules/user/shared/User.constant'
import { ForbiddenError } from '@/shared/errors/AppError.error'
import { SESSION_ROLE_FORBIDDEN } from '@/shared/errors/codes'
import type { CustomerRepositoryInterface } from '@/modules/webhook/domain/CustomerRepository.interface'

type OrderControllerDependencies = {
  readonly createWebOrderUseCase: CreateWebOrderUseCase
  readonly getOrderByShortCodeUseCase: GetOrderByShortCodeUseCase
  readonly listOrdersUseCase: ListOrdersUseCase
  readonly updateOrderStatusUseCase: UpdateOrderStatusUseCase
  readonly getAdminOrderDetailUseCase: GetAdminOrderDetailUseCase
  readonly setOrderItemUnavailableUseCase: SetOrderItemUnavailableUseCase
  readonly setOrderItemPickedUseCase: SetOrderItemPickedUseCase
  readonly notifyUnavailableItemsUseCase: NotifyUnavailableItemsUseCase
  /** Para amarrar o pedido a QUEM está logado, e não a quem o corpo disser que é. */
  readonly customerRepository: CustomerRepositoryInterface
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

    const session = await requireSession({ request, roles: CUSTOMER_ONLY })
    const input = validateBody(createWebOrderBodySchema, request.body)

    /*
     * O telefone vem da SESSÃO, nunca do corpo. Ele é a chave de `customers`, então aceitá-lo cru
     * deixaria qualquer pessoa logada lançar pedido no telefone de outra — e o pedido apareceria no
     * "meus pedidos" da vítima, com o endereço de entrega de quem pediu.
     *
     * O nome continua do corpo: o cliente pode pedir para outra pessoa receber, e isso é legítimo.
     * O `phone` do corpo é aceito pelo schema e descartado aqui — nenhuma tela precisa mandá-lo.
     */
    const customer = await this.dependencies.customerRepository.findByUserId(session.userId)
    if (!customer) throw new ForbiddenError('Account has no customer record', SESSION_ROLE_FORBIDDEN)

    const result = await this.dependencies.createWebOrderUseCase.execute({
      idempotencyKey,
      ...input,
      customer: { ...input.customer, phone: customer.phone },
    })
    response.json(201, { data: { ...result.order, items: result.items } })
  }

  handleGetByShortCode: RouteHandler = async (request, response) => {
    const shortCode = request.params[0] ?? ''
    const { phone } = validateQuery(getOrderByShortCodeQuerySchema, request.query)
    const result = await this.dependencies.getOrderByShortCodeUseCase.execute({ shortCode, requesterPhone: phone })
    response.json(200, { data: { ...result.order, items: result.items } })
  }

  handleListAdmin: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ORDER_READERS })
    const query = validateQuery(listOrdersQuerySchema, request.query)
    const result = await this.dependencies.listOrdersUseCase.execute(query)
    response.json(200, {
      data: result.items.map(withAllowedTransitions),
      pagination: { total: result.total, page: result.page, perPage: result.perPage },
    })
  }

  handleGetAdminDetail: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ORDER_READERS })
    const id = request.params[0] ?? ''
    const detail = await this.dependencies.getAdminOrderDetailUseCase.execute({ orderId: id })
    response.json(200, {
      data: {
        ...withAllowedTransitions(detail.order),
        items: detail.items,
        // Chave ausente, e não `null`, quando não há estimativa: a tela decide por presença.
        ...(detail.deliveryEstimate ? { deliveryEstimate: detail.deliveryEstimate } : {}),
      },
    })
  }

  handleSetItemUnavailable: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ORDER_PICKERS })
    // Dois parâmetros na ordem em que aparecem na rota: pedido, depois item.
    const orderId = request.params[0] ?? ''
    const itemId = request.params[1] ?? ''
    const { unavailable } = validateBody(setOrderItemUnavailableBodySchema, request.body)

    const detail = await this.dependencies.setOrderItemUnavailableUseCase.execute({ orderId, itemId, unavailable })
    response.json(200, { data: { ...withAllowedTransitions(detail.order), items: detail.items } })
  }

  /**
   * Marca um item como separado, ou todos quando a rota não traz item.
   *
   * Duas rotas, um handler: "marcar todos" numa compra de mês seriam trinta requisições, e trinta
   * chances de metade ficar marcada se a rede cair no meio.
   */
  handleSetItemPicked: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ORDER_PICKERS })
    const orderId = request.params[0] ?? ''
    const itemId = request.params[1]
    const { picked } = validateBody(setOrderItemPickedBodySchema, request.body)

    const detail = await this.dependencies.setOrderItemPickedUseCase.execute({
      orderId,
      ...(itemId ? { itemId } : {}),
      picked,
    })
    response.json(200, { data: { ...withAllowedTransitions(detail.order), items: detail.items } })
  }

  handleNotifyUnavailableItems: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ORDER_NOTIFIERS })
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
    await requireSession({ request, roles: ORDER_STATUS_WRITERS })
    const id = request.params[0] ?? ''
    const { status } = validateBody(updateOrderStatusBodySchema, request.body)
    const result = await this.dependencies.updateOrderStatusUseCase.execute({ orderId: id, status })
    response.json(200, { data: result.order })
  }
}
