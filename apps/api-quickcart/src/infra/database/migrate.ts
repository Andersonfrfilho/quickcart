/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Script standalone (`make migrate`) para rodar as migrations do Drizzle fora do
 * ciclo de vida do servidor HTTP — útil em CI/CD e antes de subir uma nova revisão.
 */

import { runMigrations, closeDatabaseConnection } from './connection'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const log = logger.child('MigrateScript')

runMigrations()
  .then(() => closeDatabaseConnection())
  .then(() => process.exit(0))
  .catch((error) => {
    log.error('migration_failed', { error: serializeError(error) })
    process.exit(1)
  })
