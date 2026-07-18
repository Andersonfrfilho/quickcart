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
import type { HealthController } from './Health.controller'

type RegisterHealthRoutesParams = {
  readonly router: Router
  readonly controller: HealthController
}

export function registerHealthRoutes(params: RegisterHealthRoutesParams): void {
  params.router.get('/v1/health', params.controller.handleGetHealth)
}
