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
import { withoutAddressCoordinates } from '@/modules/order/shared/withoutAddressCoordinates'
import { amountDueInCents } from '@/modules/order/shared/amountDue'
import { buildPricedOrderItems } from '@/modules/order/shared/buildPricedOrderItems'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { QuoteDeliveryFeeUseCase } from '@/modules/order/application/use-cases/QuoteDeliveryFee.use-case'
import type { QuoteDeliveryFeeResult } from '@/modules/order/application/types/QuoteDeliveryFee.types'
import type { DeliveryFeeTier } from '@/modules/order/domain/DeliveryFeeTierRepository.interface'
import { CUSTOMER_LOCATION_KIND, DELIVERY_QUOTE_KIND } from '@/modules/order/shared/DeliveryFeeQuote.constant'
import { ProductNotFoundError } from '@/shared/errors/CatalogErrors'
import { CartProductUnavailableError } from '@/shared/errors/CartErrors'

import { registerCustomerBodySchema, listMyOrdersQuerySchema } from './schemas/RegisterCustomer.schema'
import { checkoutQuoteBodySchema } from './schemas/CheckoutQuote.schema'

type StoreControllerDependencies = {
  readonly registerCustomerUseCase: RegisterCustomerUseCase
  readonly listMyOrdersUseCase: ListMyOrdersUseCase
  readonly productRepository: ProductRepositoryInterface
  /**
   * Único cálculo de taxa de entrega (spec §3.3) — nunca uma taxa fixa de env. A rota pública
   * recota pelo CEP a cada chamada, igual ao `CreateWebOrder`.
   */
  readonly quoteDeliveryFeeUseCase: Pick<QuoteDeliveryFeeUseCase, 'execute'>
}

/** "Até `maxDistanceKm` km, cobra `feeInCents`" — nunca coordenada nem CEP na resposta. */
type CheckoutDeliveryQuoteView =
  | { readonly kind: typeof DELIVERY_QUOTE_KIND.PICKUP }
  | { readonly kind: typeof DELIVERY_QUOTE_KIND.QUOTED; readonly distanceKm: number; readonly tier: DeliveryFeeTier }
  | { readonly kind: typeof DELIVERY_QUOTE_KIND.APPROXIMATE_MAX_TIER; readonly tier: DeliveryFeeTier }
  | { readonly kind: typeof DELIVERY_QUOTE_KIND.OUT_OF_RANGE; readonly distanceKm: number; readonly maxDistanceKm: number }
  | { readonly kind: typeof DELIVERY_QUOTE_KIND.UNAVAILABLE }

type CheckoutDeliveryQuote = {
  readonly deliveryFeeInCents: number
  readonly deliveryQuote: CheckoutDeliveryQuoteView
  readonly isDeliveryAvailable: boolean
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
      data: result.items.map((order) => ({ ...withoutAddressCoordinates(order), amountDueInCents: amountDueInCents(order) })),
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

    const pricedItems = await this.priceQuoteItems(input.items)
    const subtotalInCents = pricedItems.reduce((sum, item) => sum + item.totalInCents, 0)

    const location = input.cep ? { kind: CUSTOMER_LOCATION_KIND.CEP, cep: input.cep } : undefined
    const quote = await this.dependencies.quoteDeliveryFeeUseCase.execute({ deliveryType: input.deliveryType, location })
    const { deliveryFeeInCents, deliveryQuote, isDeliveryAvailable } = this.buildDeliveryQuote(quote)

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
        deliveryQuote,
        isDeliveryAvailable,
      },
    })
  }

  /**
   * Traduz o `QuoteDeliveryFeeResult` para o contrato público — nunca a coordenada nem o CEP que a
   * gerou (spec §3.5), e a distância sempre arredondada a 0,1 km.
   */
  private buildDeliveryQuote(quote: QuoteDeliveryFeeResult): CheckoutDeliveryQuote {
    switch (quote.kind) {
      case DELIVERY_QUOTE_KIND.PICKUP:
        return { deliveryFeeInCents: 0, deliveryQuote: { kind: quote.kind }, isDeliveryAvailable: true }
      case DELIVERY_QUOTE_KIND.QUOTED:
        return {
          deliveryFeeInCents: quote.feeInCents,
          deliveryQuote: { kind: quote.kind, distanceKm: quote.distanceKm, tier: quote.tier },
          isDeliveryAvailable: true,
        }
      case DELIVERY_QUOTE_KIND.APPROXIMATE_MAX_TIER:
        return {
          deliveryFeeInCents: quote.feeInCents,
          deliveryQuote: { kind: quote.kind, tier: quote.tier },
          isDeliveryAvailable: true,
        }
      case DELIVERY_QUOTE_KIND.OUT_OF_RANGE:
        return {
          deliveryFeeInCents: 0,
          deliveryQuote: {
            kind: quote.kind,
            distanceKm: quote.distanceKm,
            maxDistanceKm: quote.maxDistanceKm,
          },
          isDeliveryAvailable: false,
        }
      case DELIVERY_QUOTE_KIND.UNAVAILABLE:
        return { deliveryFeeInCents: 0, deliveryQuote: { kind: quote.kind }, isDeliveryAvailable: false }
    }
  }

  /*
   * Na rota PÚBLICA, inativo responde igual a inexistente (404): um 409 "indisponível" confirmaria a
   * um anônimo que o produto despublicado existe. `buildPricedOrderItems` segue distinguindo os dois
   * porque o `CreateWebOrder` (cliente logado, produto que estava no carrinho) precisa do motivo.
   */
  private async priceQuoteItems(items: Parameters<typeof buildPricedOrderItems>[1]): ReturnType<typeof buildPricedOrderItems> {
    try {
      return await buildPricedOrderItems(this.dependencies.productRepository, items)
    } catch (error) {
      if (error instanceof CartProductUnavailableError) throw new ProductNotFoundError(String(error.details?.productId ?? ''))
      throw error
    }
  }
}
