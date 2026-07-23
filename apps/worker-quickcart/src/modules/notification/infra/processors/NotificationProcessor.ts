/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Consome a fila `notification` enfileirada por UpdateOrderStatus.use-case.ts (api-quickcart)
 * com { orderId, status }. Wrapper fino do BullMQ — a lógica testável vive em
 * ProcessNotificationJob.use-case.ts.
 */

import type { Job } from 'bullmq'
import { markProcessed, wasProcessed } from '@/infra/queue/JobIdempotencyGuard'
import { whatsAppProvider } from '@/infra/whatsapp/provider'
import { findOrderNotificationData } from '@/modules/notification/infra/repositories/OrderNotificationRepository'
import { ProcessNotificationJobUseCase } from '@/modules/notification/application/use-cases/ProcessNotificationJob.use-case'
import type { OrderStatus } from '@/shared/Order.constant'

export type NotificationJobData = {
  readonly orderId: string
  readonly status: OrderStatus
}

export async function processNotificationJob(job: Job<NotificationJobData>): Promise<void> {
  if (!whatsAppProvider) {
    throw new Error('whatsapp_provider_not_configured')
  }

  const useCase = new ProcessNotificationJobUseCase({
    idempotencyGuard: { wasProcessed, markProcessed },
    orderNotificationDataFinder: { findOrderNotificationData },
    notificationSender: whatsAppProvider.messages,
  })

  await useCase.execute({ jobId: job.id, orderId: job.data.orderId, status: job.data.status })
}
