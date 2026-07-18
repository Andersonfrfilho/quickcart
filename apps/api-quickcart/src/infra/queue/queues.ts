/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Filas BullMQ do produto (spec §7). Processors ficam em `worker-quickcart` (Fase 6);
 * aqui só declaramos as filas para a API poder enfileirar jobs.
 */

import { Queue } from 'bullmq'
import { queueConnection } from './connection'
import { QUEUE_NAMES } from './queues.constant'

// Áudio de cliente aguardando transcrição — baixo valor de auditoria após concluído.
export const sttQueue = new Queue(QUEUE_NAMES.STT, {
  connection: queueConnection,
  defaultJobOptions: {
    removeOnComplete: { age: 24 * 3600, count: 500 },
    removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
  },
})

// Recibo/nota fiscal — relevante para auditoria (comprovante fiscal do pedido).
export const receiptQueue = new Queue(QUEUE_NAMES.RECEIPT, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { age: 30 * 24 * 3600, count: 2000 },
    removeOnFail: { age: 90 * 24 * 3600, count: 2000 },
  },
})

// Notificações de status de pedido — baixo valor de auditoria após entregue.
export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, {
  connection: queueConnection,
  defaultJobOptions: {
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600, count: 2000 },
  },
})
