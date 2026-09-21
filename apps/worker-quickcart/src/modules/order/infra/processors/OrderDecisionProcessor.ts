/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O relógio da cobrança única: acorda N horas depois e devolve a decisão para a API.
 *
 * O processor não decide nada — nem se ainda vale cobrar, nem o que escrever. Ele só acorda na hora
 * certa e bate na rota. Quem sabe se o pedido andou, se já foi cobrado e quais itens faltaram é a API,
 * onde essa regra já existe para o aviso original.
 */

import type { Job } from 'bullmq'
import { remindCustomerDecision } from '@/infra/api/InternalApiClient'
import { logger } from '@/shared/logger'

const orderDecisionLog = logger.child('OrderDecisionProcessor')

export type OrderDecisionJobData = {
  readonly orderId: string
}

export async function processOrderDecisionJob(job: Job<OrderDecisionJobData>): Promise<void> {
  const { orderId } = job.data
  if (!orderId) {
    orderDecisionLog.error('job_without_order_id', { jobId: job.id })
    return
  }

  await remindCustomerDecision({ orderId })
  orderDecisionLog.info('decision_reminder_requested', { orderId })
}
