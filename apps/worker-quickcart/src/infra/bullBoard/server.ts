/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import express from 'express'
import basicAuth from 'express-basic-auth'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { sttQueue, receiptQueue, notificationQueue } from '@/infra/queue/queues'
import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'

const log = logger.child('BullBoard')

export function startBullBoardServer(): ReturnType<express.Express['listen']> {
  const serverAdapter = new ExpressAdapter()
  serverAdapter.setBasePath('/')

  createBullBoard({
    queues: [new BullMQAdapter(sttQueue), new BullMQAdapter(receiptQueue), new BullMQAdapter(notificationQueue)],
    serverAdapter,
  })

  const app = express()
  app.use(basicAuth({ users: { [environment.BULL_BOARD_USER]: environment.BULL_BOARD_PASSWORD }, challenge: true }))
  app.use('/', serverAdapter.getRouter())

  return app.listen(environment.BULL_BOARD_PORT, () => log.info('bull_board_listening', { port: environment.BULL_BOARD_PORT }))
}
