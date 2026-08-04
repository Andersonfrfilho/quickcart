/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Substitui o `ProcessNotificationJob` do worker inteiro — o job, a busca do pedido, a montagem da
 * string e a guarda de idempotência em Redis.
 *
 * A guarda antiga era `notification:processed:${jobId}`, e `notificationQueue.add()` nunca passava
 * `jobId` — a BullMQ gerava um novo a cada chamada. Ela protegia reentrega do MESMO job (worker que
 * morreu no meio), e não o mesmo evento enfileirado duas vezes: dois cliques no botão de status,
 * duplo submit, retry na camada da API. Cada um virava um jobId novo, a guarda passava, e o cliente
 * recebia a mensagem duas vezes.
 *
 * `dedupeKey` fecha isso porque a chave é o FATO de negócio, não a tentativa de entrega.
 */

import type { NotificationModule } from '@adatechnology/notification-module'

import type { NotifyStatusChangedParams, OrderStatusNotifier } from '../domain/OrderStatusNotifier.interface'
import { ORDER_NOTIFICATION_CATEGORY, orderStatusTemplateKey } from '../shared/orderStatusTemplates.constant'

export function createSdkOrderStatusNotifier(params: {
  readonly module: NotificationModule
  readonly companyId: string
}): OrderStatusNotifier {
  return {
    async notifyStatusChanged(event: NotifyStatusChangedParams): Promise<void> {
      // Pedido web sem cadastro não tem destinatário. Sair calado é correto: não é falha, e
      // lançar aqui abortaria a mudança de status por causa do aviso.
      if (!event.customerId) return

      await params.module.useCases.sendNotification.execute({
        companyId: params.companyId,
        recipientUserId: event.customerId,
        category: ORDER_NOTIFICATION_CATEGORY,
        templateKey: orderStatusTemplateKey(event.status),
        payload: { shortCode: event.shortCode ?? event.orderId.slice(0, 8) },
        // O mesmo pedido no mesmo status é um aviso só, quantas vezes for enfileirado.
        dedupeKey: `order:${event.orderId}:${event.status}`,
      })
    },
  }
}
