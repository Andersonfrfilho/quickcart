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
import { validateBody } from '@/infra/http/middlewares/validateBody'
import { validateQuery } from '@/infra/http/middlewares/validateQuery'
import { requireSession } from '@/infra/http/middlewares/requireSession'
import { CUSTOMER_ONLY } from '@/modules/user/shared/User.constant'
import type { RegisterCustomerUseCase } from '@/modules/store/application/use-cases/RegisterCustomer.use-case'
import type { ListMyOrdersUseCase } from '@/modules/store/application/use-cases/ListMyOrders.use-case'
import { amountDueInCents, resolveDeliveryFeeInCents } from '@/modules/order/shared/amountDue'
import { DELIVERY_TYPE } from '@/modules/order/shared/Order.constant'

import { registerCustomerBodySchema, listMyOrdersQuerySchema } from './schemas/RegisterCustomer.schema'

type StoreControllerDependencies = {
  readonly registerCustomerUseCase: RegisterCustomerUseCase
  readonly listMyOrdersUseCase: ListMyOrdersUseCase
  /** `DELIVERY_FEE_CENTS`, exposta ao checkout web para o cliente ver a taxa antes de confirmar. */
  readonly deliveryFeeInCents: number
}

export class StoreController {
  constructor(private readonly dependencies: StoreControllerDependencies) {}

  /** Público: é a rota de quem ainda não tem conta. O papel é fixo, nunca vem do corpo. */
  handleRegister: RouteHandler = async (request, response) => {
    const input = validateBody(registerCustomerBodySchema, request.body)
    const result = await this.dependencies.registerCustomerUseCase.execute(input)

    // Sem sessão na resposta: o cadastro não loga sozinho, a tela manda para o login em seguida.
    response.json(201, { data: result })
  }

  handleListMyOrders: RouteHandler = async (request, response) => {
    const session = await requireSession({ request, roles: CUSTOMER_ONLY })
    const { page, perPage } = validateQuery(listMyOrdersQuerySchema, request.query)

    const result = await this.dependencies.listMyOrdersUseCase.execute({ userId: session.userId, page, perPage })

    response.json(200, {
      // O valor cobrado sai do backend (spec §3.4): a tela não soma itens + taxa.
      data: result.items.map((order) => ({ ...order, amountDueInCents: amountDueInCents(order) })),
      pagination: { total: result.total, page: result.page, perPage: result.perPage },
    })
  }

  /**
   * Público: a taxa de entrega que o checkout web mostra antes de confirmar. Vem da api, e não de um
   * `VITE_` duplicado, para a tela nunca divergir do que `CreateWebOrder` cobra. Vai por tipo de entrega,
   * resolvida pela mesma `resolveDeliveryFeeInCents`, para a tela só consultar — não reimplementar "retirada = 0".
   */
  handleGetCheckoutConfig: RouteHandler = async (_request, response) => {
    const configuredFeeInCents = this.dependencies.deliveryFeeInCents
    response.json(200, {
      data: {
        deliveryFeeInCentsByDeliveryType: {
          [DELIVERY_TYPE.DELIVERY]: resolveDeliveryFeeInCents({ deliveryType: DELIVERY_TYPE.DELIVERY, configuredFeeInCents }),
          [DELIVERY_TYPE.PICKUP]: resolveDeliveryFeeInCents({ deliveryType: DELIVERY_TYPE.PICKUP, configuredFeeInCents }),
        },
      },
    })
  }
}
