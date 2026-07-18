/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Entrypoint: sobe infra (db/migrations/redis), inicia o uWS listen e implementa
 * graceful shutdown (SIGTERM/SIGINT) com timeout de força-saída, evitando pods presos
 * em Kubernetes durante rolling updates.
 */

import { us_listen_socket_close, type us_listen_socket } from 'uWebSockets.js'
import { createServer } from '@/infra/http/server'
import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'
import { LOG_EVENTS } from '@/shared/constants/log-events.constant'
import { initSentry } from '@/infra/observability/sentry'
import { checkDatabaseConnection, closeDatabaseConnection, runMigrations } from '@/infra/database/connection'
import { checkRedisConnection, redis } from '@/infra/redis/connection'

const SHUTDOWN_TIMEOUT_MS = 10_000
const bootLog = logger.child('Bootstrap')

let listenSocket: us_listen_socket | undefined
let shuttingDown = false

async function start(): Promise<void> {
  bootLog.info(LOG_EVENTS.SERVER_STARTING)
  initSentry()

  await checkDatabaseConnection()
  await runMigrations()
  await checkRedisConnection()

  const app = createServer()

  await new Promise<void>((resolve, reject) => {
    app.listen(environment.PORT, (socket) => {
      if (!socket) {
        reject(new Error(`Failed to listen on port ${environment.PORT}`))
        return
      }
      listenSocket = socket
      resolve()
    })
  })

  bootLog.info(LOG_EVENTS.SERVER_READY, { port: environment.PORT })
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  bootLog.info(LOG_EVENTS.SERVER_SHUTTING_DOWN, { signal })

  const forceExitTimer = setTimeout(() => {
    bootLog.error(LOG_EVENTS.SERVER_SHUTDOWN_TIMEOUT)
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS)

  try {
    if (listenSocket) us_listen_socket_close(listenSocket)
    await Promise.all([redis.quit(), closeDatabaseConnection()])
    clearTimeout(forceExitTimer)
    bootLog.info(LOG_EVENTS.SERVER_SHUTDOWN_COMPLETE)
    process.exit(0)
  } catch (error) {
    clearTimeout(forceExitTimer)
    bootLog.error(LOG_EVENTS.SERVER_SHUTDOWN_ERROR, { error: String(error) })
    process.exit(1)
  }
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})
process.on('SIGINT', () => {
  void shutdown('SIGINT')
})

start().catch((error) => {
  bootLog.error(LOG_EVENTS.SERVER_FAILED, { error: error instanceof Error ? error.message : String(error) })
  process.exit(1)
})
