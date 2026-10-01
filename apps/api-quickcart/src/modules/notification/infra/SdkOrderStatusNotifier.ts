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

import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

import type { NotifyStatusChangedParams, OrderStatusNotifier } from '../domain/OrderStatusNotifier.interface'
import {
  ORDER_NOTIFICATION_CATEGORY,
  orderStatusTemplateKey,
  renderOrderStatusBody,
} from '../shared/orderStatusTemplates.constant'

const notifierLog = logger.child('OrderStatusNotifier')

/**
 * A janela de atendimento da Meta. Dentro dela o WhatsApp aceita texto livre; fora, só template
 * aprovado — e é a Graph API quem conta as horas, não nós.
 */
const FREE_FORM_WINDOW_HOURS = 24

/**
 * O canal que não depende da janela e por isso nunca é pulado.
 *
 * Quando o aviso sai como texto livre, o módulo ainda escreve a notificação no histórico: é o que
 * deixa o cliente reler o que foi avisado, e o que mantém a auditoria igual nos dois caminhos.
 */
const HISTORY_ONLY_CHANNELS = ['inbox'] as const

/**
 * O caminho de texto livre, igual ao do aviso de item em falta.
 *
 * Ausente, o notificador se comporta exatamente como antes — fan-out por template. É opcional
 * porque o host de teste monta o notificador sem canal de WhatsApp, e porque a capacidade que falta
 * deve degradar para o comportamento antigo, não quebrar o envio.
 */
export type FreeFormWindowDelivery = {
  readonly resolveWhatsAppNumber: (customerId: string) => Promise<string | undefined>
  readonly hoursSinceLastInbound: (whatsAppNumber: string) => Promise<number | undefined>
  readonly sendText: (whatsAppNumber: string, body: string) => Promise<void>
}

export type CreateSdkOrderStatusNotifierParams = {
  readonly module: NotificationModule
  readonly companyId: string
  readonly freeFormWindow?: FreeFormWindowDelivery
}

export function createSdkOrderStatusNotifier(params: CreateSdkOrderStatusNotifierParams): OrderStatusNotifier {
  /**
   * Devolve o número só quando a janela está comprovadamente aberta.
   *
   * `undefined` em qualquer degrau — cliente sem telefone, conversa que nunca teve inbound, erro de
   * leitura — significa "não sei", e não saber empurra para o template, que é o caminho que funciona
   * fora da janela. O inverso (assumir aberta) manda texto livre que a Meta recusa, e o cliente fica
   * sem aviso nenhum.
   */
  async function resolveOpenWindowNumber(customerId: string): Promise<string | undefined> {
    const delivery = params.freeFormWindow
    if (!delivery) return undefined

    try {
      const whatsAppNumber = await delivery.resolveWhatsAppNumber(customerId)
      if (!whatsAppNumber) return undefined

      const hours = await delivery.hoursSinceLastInbound(whatsAppNumber)
      if (hours === undefined || hours >= FREE_FORM_WINDOW_HOURS) return undefined

      return whatsAppNumber
    } catch (error: unknown) {
      notifierLog.warn('free_form_window_undetermined', { error: serializeError(error) })
      return undefined
    }
  }

  return {
    async notifyStatusChanged(event: NotifyStatusChangedParams): Promise<void> {
      if (!event.customerId) return

      const shortCode = event.shortCode ?? event.orderId.slice(0, 8)
      const body = renderOrderStatusBody({ status: event.status, shortCode })
      const whatsAppNumber = body ? await resolveOpenWindowNumber(event.customerId) : undefined

      await params.module.useCases.sendNotification.execute({
        companyId: params.companyId,
        recipientUserId: event.customerId,
        category: ORDER_NOTIFICATION_CATEGORY,
        templateKey: orderStatusTemplateKey(event.status),
        payload: { shortCode },
        dedupeKey: `order:${event.orderId}:${event.status}`,
        /*
         * Dentro da janela o WhatsApp sai por fora do fan-out, então o módulo fica só com o
         * histórico. Sem restringir aqui, o mesmo aviso sairia duas vezes para o mesmo número.
         */
        ...(whatsAppNumber ? { channels: HISTORY_ONLY_CHANNELS } : {}),
      })

      if (!whatsAppNumber || !body) return

      /*
       * Depois do módulo, e não antes: a notificação gravada é o registro do que foi avisado, e
       * falhar aqui com o registro já feito é melhor do que mandar a mensagem e perder o registro.
       */
      await params.freeFormWindow?.sendText(whatsAppNumber, body)
      notifierLog.info('status_notified_free_form', { orderId: event.orderId, status: event.status })
    },
  }
}
