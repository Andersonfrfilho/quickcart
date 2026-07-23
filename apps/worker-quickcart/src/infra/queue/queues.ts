/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Instâncias Queue usadas apenas pelo Bull Board (inspeção) e pela limpeza periódica —
 * os jobs em si são enfileirados pela api-quickcart. defaultJobOptions espelha
 * apps/api-quickcart/src/infra/queue/queues.ts para a UI do Bull Board refletir a
 * retenção real configurada na origem.
 */

import { Queue } from 'bullmq'
import { queueConnection } from './connection'
import { QUEUE_NAMES } from './queues.constant'

export const sttQueue = new Queue(QUEUE_NAMES.STT, {
  connection: queueConnection,
  defaultJobOptions: {
    removeOnComplete: { age: 24 * 3600, count: 500 },
    removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
  },
})

export const receiptQueue = new Queue(QUEUE_NAMES.RECEIPT, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { age: 30 * 24 * 3600, count: 2000 },
    removeOnFail: { age: 90 * 24 * 3600, count: 2000 },
  },
})

export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, {
  connection: queueConnection,
  defaultJobOptions: {
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600, count: 2000 },
  },
})
