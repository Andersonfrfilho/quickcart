/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { checkDatabaseConnection, closeDatabaseConnection } from '@/infra/database/connection'
import { startWorkers } from '@/infra/queue/workers'
import { queueConnection } from '@/infra/queue/connection'
import { startBullBoardServer } from '@/infra/bullBoard/server'
import { startQueueCleanup } from '@/infra/queue/cleanup'
import { LOG_EVENTS } from '@/shared/log-events.constant'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const bootstrapLog = logger.child('Bootstrap')

const SHUTDOWN_TIMEOUT_MS = 10_000

async function main(): Promise<void> {
  await checkDatabaseConnection()
  const workers = startWorkers()
  const bullBoardServer = startBullBoardServer()
  const cleanupInterval = startQueueCleanup()
  bootstrapLog.info(LOG_EVENTS.STARTUP_COMPLETE)

  async function shutdown(signal: string): Promise<void> {
    bootstrapLog.info(LOG_EVENTS.SHUTTING_DOWN, { signal })
    const forceExitTimeout = setTimeout(() => {
      bootstrapLog.error(LOG_EVENTS.SHUTDOWN_TIMEOUT)
      process.exit(1)
    }, SHUTDOWN_TIMEOUT_MS)

    clearInterval(cleanupInterval)
    bullBoardServer.close()
    await Promise.all(workers.map((worker) => worker.close()))
    await queueConnection.quit()
    await closeDatabaseConnection()

    clearTimeout(forceExitTimeout)
    bootstrapLog.info(LOG_EVENTS.SHUTDOWN_COMPLETE)
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

main().catch((error) => {
  bootstrapLog.error(LOG_EVENTS.STARTUP_FAILED, { error: serializeError(error) })
  process.exit(1)
})
