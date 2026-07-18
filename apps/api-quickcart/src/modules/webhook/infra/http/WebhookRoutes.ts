/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { Router } from '@/infra/http/router'
import type { WebhookController } from './Webhook.controller'

type RegisterWebhookRoutesParams = {
  readonly router: Router
  readonly webhookController: WebhookController
}

export function registerWebhookRoutes(params: RegisterWebhookRoutesParams): void {
  const { router, webhookController } = params

  router.get('/v1/webhook/whatsapp', webhookController.handleVerify)
  router.post('/v1/webhook/whatsapp', webhookController.handleReceive)
}
