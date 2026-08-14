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

/**
 * Entregas do `notification-module`. O `attempts` fica em 1 de propósito — o retry é decidido por
 * `applyDeliveryOutcome`, que distingue `retriable` de `permanent`. Deixar o BullMQ retentar
 * duplicaria a política e reenviaria também o que é definitivo.
 */
export const notificationDeliveryQueue = new Queue(QUEUE_NAMES.NOTIFICATION_DELIVERY, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600, count: 2000 },
  },
})

// Cópia de mídia da Meta para o storage. A URL de download da Meta expira, então tentar de novo
// tarde demais não recupera nada — daí backoff curto e poucas tentativas, em vez do escalonamento
// longo do recibo. O use case é idempotente por sourceMediaId, então reentrega não duplica objeto.
/**
 * A cobrança da decisão. Poucas tentativas e backoff longo: nada aqui é urgente.
 *
 * O job só existe para acordar horas depois — se o Redis estiver fora no instante exato, tentar de novo
 * em minutos chega perfeitamente a tempo. O `removeOnComplete` é curto porque o que interessa depois é o
 * carimbo no pedido, não o histórico da fila.
 */
export const orderDecisionQueue = new Queue(QUEUE_NAMES.ORDER_DECISION, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { age: 24 * 3600, count: 500 },
    removeOnFail: { age: 7 * 24 * 3600, count: 500 },
  },
})

export const documentsQueue = new Queue(QUEUE_NAMES.DOCUMENTS, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 4,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
    removeOnFail: { age: 30 * 24 * 3600, count: 1000 },
  },
})
