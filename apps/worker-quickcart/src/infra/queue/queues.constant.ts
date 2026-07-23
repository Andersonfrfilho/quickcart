/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Nomes idênticos aos declarados em apps/api-quickcart/src/infra/queue/queues.constant.ts —
 * BullMQ identifica filas pelo nome, não pela instância; ambos os processos apontam para o
 * mesmo Redis e precisam concordar nesses literais.
 */

export const QUEUE_NAMES = {
  STT: 'stt',
  RECEIPT: 'receipt',
  NOTIFICATION: 'notification',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]
