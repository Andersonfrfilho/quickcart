/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Monta o Router e registra as rotas de cada módulo. Deliberadamente mais
 * enxuto que o server.ts de referência (sem SSE, GatedRouter ou sessão JWT —
 * quickcart usa apenas Bearer estático para admin/interno nesta fase). O
 * listening socket em si é responsabilidade do index.ts via Bun.serve().
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

export function createRouter(): Router {
  const router = new Router()

  router.registerCorsPreflight()

  registerHealthRoutes({ router, controller: container.health.controller })
  registerCatalogRoutes({
    router,
    categoryController: container.catalog.categoryController,
    productController: container.catalog.productController,
  })
  registerOrderRoutes({ router, orderController: container.order.orderController })
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

  registerOpenApiRoutes({ router, notificationRoutes })

  router.registerNotFoundHandler()

  return router
}
