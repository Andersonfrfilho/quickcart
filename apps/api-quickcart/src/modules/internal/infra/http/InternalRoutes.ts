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
import type { InternalController } from './Internal.controller'

type RegisterInternalRoutesParams = {
  readonly router: Router
  readonly internalController: InternalController
}

export function registerInternalRoutes(params: RegisterInternalRoutesParams): void {
  const { router, internalController } = params

  router.post('/v1/internal/conversation/resume', internalController.handleResumeConversation)
}
