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
import type { GetHealthStatusUseCase } from '@/modules/health/application/use-cases/GetHealthStatus.use-case'

export class HealthController {
  constructor(private readonly getHealthStatusUseCase: GetHealthStatusUseCase) {}

  handleGetHealth: RouteHandler = async (_request, response) => {
    const result = await this.getHealthStatusUseCase.execute()
    const statusCode = result.status === 'ok' ? 200 : 503
    response.json(statusCode, { data: result })
  }
}
