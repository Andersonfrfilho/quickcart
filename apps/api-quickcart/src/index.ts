/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Entrypoint: sobe infra (db/migrations/redis), inicia o Bun.serve() e implementa
 * graceful shutdown (SIGTERM/SIGINT) com timeout de força-saída, evitando pods presos
 * em Kubernetes durante rolling updates.
 */

import { createRouter } from '@/infra/http/server'
import { getQuickCartUserModule } from '@/modules/user/infra/userModule'
import { seedBootstrapUsers } from '@/modules/user/infra/seedBootstrapUsers'
import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'
import { LOG_EVENTS } from '@/shared/constants/log-events.constant'
import { initSentry } from '@/infra/observability/sentry'
import { checkDatabaseConnection, closeDatabaseConnection, runMigrations } from '@/infra/database/connection'
import { seedMainFlow } from '@/infra/container'
import { checkRedisConnection, closeRedisConnection } from '@/infra/redis/connection'
import { serializeError } from '@/shared/serializeError'
import { INTERNAL_ERROR } from '@/shared/errors/codes'

const SHUTDOWN_TIMEOUT_MS = 10_000
// Folga sobre o heartbeat de 25s do stream de conversa (ConversationStream.controller.ts).
const SSE_IDLE_TIMEOUT_SECONDS = 60
const bootLog = logger.child('Bootstrap')

let server: ReturnType<typeof Bun.serve> | undefined
let shuttingDown = false

async function start(): Promise<void> {
  bootLog.info(LOG_EVENTS.SERVER_STARTING)
  initSentry()

  await checkDatabaseConnection()
  await runMigrations()
await seedMainFlow()
  await checkRedisConnection()

  const userModule = await getQuickCartUserModule()
  await seedBootstrapUsers({ userModule })
  const router = createRouter({ userModule })

  server = Bun.serve({
    port: environment.PORT,
    // O padrão do Bun é 10s, e o keep-alive do SSE só escreve a cada 25s: a inbox perdia o stream
    // antes do primeiro heartbeat e ficava mostrando dado velho sem erro nenhum. A janela precisa
    // ser maior que o heartbeat, não infinita — conexão pendurada ainda deve morrer sozinha.
    idleTimeout: SSE_IDLE_TIMEOUT_SECONDS,
    fetch: (request) => router.handle(request),
    error(error) {
      bootLog.error(LOG_EVENTS.RESPONSE_UNHANDLED, { message: serializeError(error) })
      return new Response(JSON.stringify({ error: { code: INTERNAL_ERROR, message: 'Internal server error' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    },
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
    server?.stop()
    await Promise.all([closeRedisConnection(), closeDatabaseConnection()])
    clearTimeout(forceExitTimer)
    bootLog.info(LOG_EVENTS.SERVER_SHUTDOWN_COMPLETE)
    process.exit(0)
  } catch (error) {
    clearTimeout(forceExitTimer)
    bootLog.error(LOG_EVENTS.SERVER_SHUTDOWN_ERROR, { error: serializeError(error) })
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
  bootLog.error(LOG_EVENTS.SERVER_FAILED, { error: serializeError(error) })
  process.exit(1)
})
