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
  })

  router.registerNotFoundHandler()

  return router
}
