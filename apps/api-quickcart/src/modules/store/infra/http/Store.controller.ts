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
import { buildPricedOrderItems } from '@/modules/order/shared/buildPricedOrderItems'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'

import { registerCustomerBodySchema, listMyOrdersQuerySchema } from './schemas/RegisterCustomer.schema'
import { checkoutQuoteBodySchema } from './schemas/CheckoutQuote.schema'

type StoreControllerDependencies = {
  readonly registerCustomerUseCase: RegisterCustomerUseCase
  readonly listMyOrdersUseCase: ListMyOrdersUseCase
  readonly productRepository: ProductRepositoryInterface
  /** `DELIVERY_FEE_CENTS`, usada pela cotação para resolver a taxa por tipo de entrega. */
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
   * Público (a loja navega sem login, spec §3.4 T2.2): o checkout web mostra Subtotal, Taxa e
   * Total ANTES de confirmar, e os três precisam bater com o que `CreateWebOrder` vai cobrar.
   * Os preços vêm sempre do banco (`buildPricedOrderItems`, a mesma leitura/validação do
   * `CreateWebOrder`) — o carrinho do navegador pode ter preço velho. Substitui o antigo
   * `GET /v1/store/checkout-config`: aquele só devolvia a taxa por tipo de entrega, sem o total
   * cobrado; esta rota cobre o mesmo caso e o de exibir o total, então o outro foi removido.
   */
  handleGetCheckoutQuote: RouteHandler = async (request, response) => {
    const input = validateBody(checkoutQuoteBodySchema, request.body)

    const pricedItems = await buildPricedOrderItems(this.dependencies.productRepository, input.items)
    const subtotalInCents = pricedItems.reduce((sum, item) => sum + item.totalInCents, 0)
    const deliveryFeeInCents = resolveDeliveryFeeInCents({
      deliveryType: input.deliveryType,
      configuredFeeInCents: this.dependencies.deliveryFeeInCents,
    })

    response.json(200, {
      data: {
        subtotalInCents,
        deliveryFeeInCents,
        amountDueInCents: amountDueInCents({ totalInCents: subtotalInCents, deliveryFeeInCents }),
        items: pricedItems.map((item) => ({
          productId: item.productId,
          unitPriceInCents: item.unitPriceInCents,
          lineTotalInCents: item.totalInCents,
        })),
      },
    })
  }
}
