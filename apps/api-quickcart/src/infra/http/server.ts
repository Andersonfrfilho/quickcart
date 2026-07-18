/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Monta a app uWebSockets.js e registra as rotas de cada módulo. Deliberadamente
 * mais enxuto que o server.ts de referência (sem SSE, GatedRouter ou sessão JWT —
 * quickcart usa apenas Bearer estático para admin/interno nesta fase).
 */

import { App, type TemplatedApp } from 'uWebSockets.js'
import { Router } from './router'
import { container } from '@/infra/container'
import { registerHealthRoutes } from '@/modules/health/infra/http/HealthRoutes'
import { registerCatalogRoutes } from '@/modules/catalog/infra/http/CatalogRoutes'
import { registerWebhookRoutes } from '@/modules/webhook/infra/http/WebhookRoutes'

export function createServer(): TemplatedApp {
  const app = App()
  const router = new Router(app)

  router.registerCorsPreflight()

  registerHealthRoutes({ router, controller: container.health.controller })
  registerCatalogRoutes({
    router,
    categoryController: container.catalog.categoryController,
    productController: container.catalog.productController,
  })
  registerWebhookRoutes({ router, webhookController: container.webhook.controller })

  router.registerNotFoundHandler()

  return app
}
