/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Container de injeção de dependência manual: instancia repositórios, use-cases e
 * controllers uma única vez por processo e expõe tudo como um objeto plano. Módulos
 * de catálogo entram na Fase 2; health é o único módulo ligado na Fase 1.
 */

import { DatabaseHealthChecker } from '@/infra/database/DatabaseHealthChecker'
import { RedisHealthChecker } from '@/infra/redis/RedisHealthChecker'
import { GetHealthStatusUseCase } from '@/modules/health/application/use-cases/GetHealthStatus.use-case'
import { HealthController } from '@/modules/health/infra/http/Health.controller'

type HealthModule = {
  readonly controller: HealthController
}

function buildHealthModule(): HealthModule {
  const databaseHealthChecker = new DatabaseHealthChecker()
  const cacheHealthChecker = new RedisHealthChecker()
  const getHealthStatusUseCase = new GetHealthStatusUseCase({ databaseHealthChecker, cacheHealthChecker })
  const controller = new HealthController(getHealthStatusUseCase)

  return { controller }
}

export const container = {
  health: buildHealthModule(),
}
