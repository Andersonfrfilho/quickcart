/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Idempotência chaveada em job.id: um retry do mesmo evento de status não deve reenviar a
 * mesma mensagem — uma mudança de status real sempre gera um job novo (ver worker.md).
 */

import type { OrderNotificationData } from '@/modules/notification/infra/repositories/OrderNotificationRepository'
import { buildOrderStatusMessage } from '@/modules/notification/shared/NotificationMessages.constant'
import type { ProcessNotificationJobParams } from '@/modules/notification/application/types/ProcessNotificationJob.types'
import { LOG_EVENTS } from '@/shared/log-events.constant'
import { logger } from '@/shared/logger'

export type NotificationIdempotencyGuard = {
  readonly wasProcessed: (key: string) => Promise<boolean>
  readonly markProcessed: (key: string) => Promise<void>
}

export type OrderNotificationDataFinder = {
  readonly findOrderNotificationData: (orderId: string) => Promise<OrderNotificationData | undefined>
}

export type NotificationSender = {
  readonly sendText: (to: string, body: string) => Promise<unknown>
}

type ProcessNotificationJobUseCaseDependencies = {
  readonly idempotencyGuard: NotificationIdempotencyGuard
  readonly orderNotificationDataFinder: OrderNotificationDataFinder
  readonly notificationSender: NotificationSender
}

const notificationProcessorLog = logger.child('NotificationProcessor')

export class ProcessNotificationJobUseCase {
  constructor(private readonly dependencies: ProcessNotificationJobUseCaseDependencies) {}

  async execute(params: ProcessNotificationJobParams): Promise<void> {
    const { jobId, orderId, status } = params
    const idempotencyKey = `notification:processed:${jobId}`

    if (await this.dependencies.idempotencyGuard.wasProcessed(idempotencyKey)) {
      notificationProcessorLog.info(LOG_EVENTS.NOTIFICATION_JOB_PROCESSED, { jobId, orderId, status, alreadyProcessed: true })
      return
    }

    const orderData = await this.dependencies.orderNotificationDataFinder.findOrderNotificationData(orderId)
    if (!orderData) {
      notificationProcessorLog.warn(LOG_EVENTS.NOTIFICATION_JOB_FAILED, { jobId, orderId, reason: 'order_not_found' })
      return
    }

    const message = buildOrderStatusMessage(status, orderData.shortCode)
    await this.dependencies.notificationSender.sendText(orderData.customerPhone, message)
    await this.dependencies.idempotencyGuard.markProcessed(idempotencyKey)

    notificationProcessorLog.info(LOG_EVENTS.NOTIFICATION_JOB_PROCESSED, { jobId, orderId, status })
  }
}
