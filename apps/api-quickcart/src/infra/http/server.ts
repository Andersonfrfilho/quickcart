/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Monta o Router e registra as rotas de cada módulo. O listening socket em si é
 * responsabilidade do index.ts via Bun.serve().
 *
 * O `userModule` chega pronto por parâmetro porque sua criação é assíncrona (o pacote resolve
 * provedores no boot) e o container do quickcart é montado de forma síncrona.
 */

import { Router } from './router'
import { container } from '@/infra/container'
import { registerHealthRoutes } from '@/modules/health/infra/http/HealthRoutes'
import { registerCatalogRoutes } from '@/modules/catalog/infra/http/CatalogRoutes'
import { registerOrderRoutes } from '@/modules/order/infra/http/OrderRoutes'
import { registerWebhookRoutes } from '@/modules/webhook/infra/http/WebhookRoutes'
import { registerInternalRoutes } from '@/modules/internal/infra/http/InternalRoutes'
import { registerConversationRoutes } from '@/modules/conversation/infra/http/ConversationRoutes'
import { createNotificationRoutes } from '@adatechnology/notification-module'
import { createModuleFetchRouter } from '@adatechnology/module-http/fetch'
import { registerOpenApiRoutes } from '@/modules/notification/infra/http/OpenApiRoutes'
import { notificationAuthContextResolver } from '@/modules/notification/infra/notificationModule'
import { createUserRoutes } from '@adatechnology/user-module'
import { createCustomerModule, createCustomerRoutes } from '@adatechnology/customer-module'
import { db } from '@/infra/database/connection'
import { DEFAULT_COUNTRY_CODE } from '@/shared/phone.constant'
import type { UserModule } from '@adatechnology/user-module'
import { createUserAuthContextResolver } from '@/modules/user/infra/userAuthContextResolver'
import { StoreController } from '@/modules/store/infra/http/Store.controller'
import { registerStoreRoutes } from '@/modules/store/infra/http/StoreRoutes'
import { FixedWindowRateLimiter } from '@/infra/http/rate-limit/FixedWindowRateLimiter'
import { RedisRateLimitStore } from '@/infra/http/rate-limit/RedisRateLimitStore'
import { redis } from '@/infra/redis/connection'
import {
  CHECKOUT_QUOTE_RATE_LIMIT_PER_WINDOW,
  CHECKOUT_QUOTE_RATE_LIMIT_SCOPE,
  CHECKOUT_QUOTE_RATE_LIMIT_WINDOW_SECONDS,
  STORE_REGISTER_RATE_LIMIT_PER_WINDOW,
  STORE_REGISTER_RATE_LIMIT_SCOPE,
  STORE_REGISTER_RATE_LIMIT_WINDOW_SECONDS,
} from '@/modules/store/shared/Store.constant'
import { RegisterCustomerUseCase } from '@/modules/store/application/use-cases/RegisterCustomer.use-case'
import { ListMyOrdersUseCase } from '@/modules/store/application/use-cases/ListMyOrders.use-case'
import { environment } from '@/infra/config/environment'
import {
  AUTH_LOGIN_RATE_LIMIT_PER_WINDOW,
  AUTH_LOGIN_RATE_LIMIT_SCOPE,
  AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
  AUTH_LOGIN_ROUTE_METHOD,
  AUTH_LOGIN_ROUTE_PATHNAME,
} from '@/modules/user/shared/User.constant'

export type CreateRouterParams = {
  readonly userModule: UserModule
}

export function createRouter({ userModule }: CreateRouterParams): Router {
  const router = new Router()

  router.registerCorsPreflight()

  registerHealthRoutes({ router, controller: container.health.controller })
  registerCatalogRoutes({
    router,
    categoryController: container.catalog.categoryController,
    productController: container.catalog.productController,
  })
  registerOrderRoutes({
    router,
    orderController: container.order.orderController,
    deliveryFeeTiersController: container.order.deliveryFeeTiersController,
    orderStreamController: container.order.orderStreamController,
  })
  registerWebhookRoutes({ router, webhookController: container.webhook.controller })
  registerInternalRoutes({ router, internalController: container.internal.controller })
  registerConversationRoutes({
    router,
    conversationController: container.conversationHttp.conversationController,
    settingsController: container.conversationHttp.settingsController,
    streamController: container.conversationHttp.streamController,
    previewTranscriptController: container.conversationHttp.previewTranscriptController,
    previewMediaController: container.conversationHttp.previewMediaController,
    previewInboundController: container.conversationHttp.previewInboundController,
    unmatchedDemandController: container.conversationHttp.unmatchedDemandController,
    checkoutContextController: container.conversationHttp.checkoutContextController,
  })

  // Notificação inteira — inbox, SSE do sino, devices, preferências e templates — em três linhas.
  // O módulo traz validação, autorização por objeto e filtro de erro; não há controller a escrever.
  // UMA tabela, dois consumidores: o adaptador que serve e o documento que descreve. Derivar os
  // dois da mesma variável é o que impede a documentação de descrever uma rota que não existe.
  const notificationRoutes = createNotificationRoutes({ module: container.notification })

  router.mount(
    createModuleFetchRouter({
      routes: notificationRoutes,
      basePath: '/v1',
      // O resolvedor é do HOST, não do módulo — o pacote recebe identidade pronta e não a produz.
      authResolver: notificationAuthContextResolver,
    }),
  )

  /*
   * Usuário e sessão inteiros — login, refresh, logout, perfil, reset de senha — vindos do pacote.
   *
   * O resolvedor é do HOST mesmo aqui: o pacote assina o token e sabe verificá-lo, mas quem traduz
   * `role` em `scope` é o produto, porque papel é vocabulário do produto.
   */
  const userRoutes = createUserRoutes({ module: userModule })
  const rateLimitStore = new RedisRateLimitStore(redis)
  const loginRateLimiter = new FixedWindowRateLimiter({
    store: rateLimitStore,
    scope: AUTH_LOGIN_RATE_LIMIT_SCOPE,
    limit: AUTH_LOGIN_RATE_LIMIT_PER_WINDOW,
    windowSeconds: AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
  })

  // A rota é do pacote; o limite é do host, aplicado na montagem sem mudar o pacote.
  router.mount(
    loginRateLimiter.protectMountedRoute({
      moduleRouter: createModuleFetchRouter({
        routes: userRoutes,
        basePath: '/v1',
        authResolver: createUserAuthContextResolver({
          userModule,
          companyId: environment.WHATSAPP_COMPANY_ID,
        }),
      }),
      method: AUTH_LOGIN_ROUTE_METHOD,
      pathname: AUTH_LOGIN_ROUTE_PATHNAME,
    }),
  )

  /*
   * Cadastro de clientes, do pacote. O `db` e a configuração vêm do host; o pacote não escolhe
   * driver nem decide se o produto é multiempresa.
   *
   * `single` porque o QuickCart é uma loja só: `company_id` fica nulo, e o índice único de WhatsApp
   * usa `NULLS NOT DISTINCT` justamente para continuar valendo nesse caso.
   *
   * Sem cifra e sem `encryptedDocuments`: o QuickCart não guarda CPF hoje. Declarar documento
   * cifrado sem plugar a cifra falha no boot — capacidade por ausência, e não uma flag esquecida.
   */
  const customerModule = createCustomerModule({
    db,
    config: { tenancy: { mode: 'single' }, defaultCountryCode: DEFAULT_COUNTRY_CODE },
  })

  router.mount(
    createModuleFetchRouter({
      routes: createCustomerRoutes({ module: customerModule }),
      basePath: '/v1',
      authResolver: createUserAuthContextResolver({
        userModule,
        companyId: environment.WHATSAPP_COMPANY_ID,
      }),
    }),
  )

  /*
   * A loja monta-se aqui, e não no container: `RegisterCustomer` precisa do `userModule`, cuja
   * criação é assíncrona, e o container do quickcart é síncrono.
   */
  const storeController = new StoreController({
    registerCustomerUseCase: new RegisterCustomerUseCase({
      userModule,
      customerRepository: container.storeRepositories.customerRepository,
    }),
    listMyOrdersUseCase: new ListMyOrdersUseCase({
      orderRepository: container.storeRepositories.orderRepository,
      customerRepository: container.storeRepositories.customerRepository,
    }),
    productRepository: container.storeRepositories.productRepository,
    quoteDeliveryFeeUseCase: container.order.quoteDeliveryFeeUseCase,
  })

  const checkoutQuoteRateLimiter = new FixedWindowRateLimiter({
    store: rateLimitStore,
    scope: CHECKOUT_QUOTE_RATE_LIMIT_SCOPE,
    limit: CHECKOUT_QUOTE_RATE_LIMIT_PER_WINDOW,
    windowSeconds: CHECKOUT_QUOTE_RATE_LIMIT_WINDOW_SECONDS,
  })

  const registerRateLimiter = new FixedWindowRateLimiter({
    store: rateLimitStore,
    scope: STORE_REGISTER_RATE_LIMIT_SCOPE,
    limit: STORE_REGISTER_RATE_LIMIT_PER_WINDOW,
    windowSeconds: STORE_REGISTER_RATE_LIMIT_WINDOW_SECONDS,
  })

  /*
   * O webhook do WhatsApp fica SEM limite por IP de propósito: as requisições vêm da Meta, de
   * poucos IPs compartilhados por todos os clientes — um teto por IP derrubaria mensagens reais.
   * A proteção dele é a assinatura HMAC + nonce do meta-whatsapp-module.
   */
  registerStoreRoutes({ router, storeController, checkoutQuoteRateLimiter, registerRateLimiter })

  registerOpenApiRoutes({ router, notificationRoutes })

  router.registerNotFoundHandler()

  return router
}
