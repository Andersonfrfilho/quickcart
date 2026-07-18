/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { HealthCheckerInterface } from '@/shared/providers/HealthChecker.interface'
import type { DependencyStatus, GetHealthStatusResult } from '../types/GetHealthStatus.types'

type GetHealthStatusUseCaseDependencies = {
  readonly databaseHealthChecker: HealthCheckerInterface
  readonly cacheHealthChecker: HealthCheckerInterface
}

export class GetHealthStatusUseCase {
  constructor(private readonly dependencies: GetHealthStatusUseCaseDependencies) {}

  async execute(): Promise<GetHealthStatusResult> {
    const [databaseIsUp, redisIsUp] = await Promise.all([
      this.dependencies.databaseHealthChecker.ping(),
      this.dependencies.cacheHealthChecker.ping(),
    ])

    const database: DependencyStatus = databaseIsUp ? 'up' : 'down'
    const redis: DependencyStatus = redisIsUp ? 'up' : 'down'
    const status = database === 'up' && redis === 'up' ? 'ok' : 'degraded'

    return { status, checks: { database, redis } }
  }
}
