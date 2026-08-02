/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { ORDER_STATUS, type OrderStatus } from '@/shared/Order.constant'
import { logger } from '@/shared/logger'

const notificationMessagesLog = logger.child('NotificationMessages')

const NOTIFICATION_MESSAGE_BY_STATUS: Record<OrderStatus, (shortCode: string) => string> = {
  [ORDER_STATUS.PENDING_CONFIRMATION]: (shortCode) => `⏳ Pedido ${shortCode} recebido e aguardando confirmação.`,
  [ORDER_STATUS.CONFIRMED]: (shortCode) => `✅ Pedido ${shortCode} confirmado! Já vamos começar a separar.`,
  [ORDER_STATUS.PREPARING]: (shortCode) => `🛒 Pedido ${shortCode} está sendo preparado.`,
  // Neutro entre entrega e retirada: o worker recebe status e código, não sabe qual dos dois é — e
  // prometer "sai agora" num pedido de retirada faria o cliente esperar em casa.
  [ORDER_STATUS.SEPARATED]: (shortCode) => `✅ Pedido ${shortCode} está separado e pronto.`,
  [ORDER_STATUS.OUT_FOR_DELIVERY]: (shortCode) => `🚚 Pedido ${shortCode} saiu para entrega!`,
  [ORDER_STATUS.READY_FOR_PICKUP]: (shortCode) => `📦 Pedido ${shortCode} está pronto para retirada.`,
  [ORDER_STATUS.COMPLETED]: (shortCode) => `🎉 Pedido ${shortCode} concluído. Obrigado pela preferência!`,
  [ORDER_STATUS.CANCELLED]: (shortCode) => `❌ Pedido ${shortCode} foi cancelado.`,
}

/**
 * Mensagem genérica para status que este worker ainda não conhece.
 *
 * O mapa é exaustivo em tempo de compilação, mas em DEPLOY a API sobe antes do worker: por alguns
 * minutos existe uma versão que grava status novo e outra que não sabe traduzi-lo. Sem isto, o job
 * estourava com "NOTIFICATION_MESSAGE_BY_STATUS[status] is not a function" e o cliente ficava sem aviso
 * nenhum — foi exatamente o que aconteceu ao adicionar `separated`.
 *
 * Aviso genérico é pior que o específico e muito melhor que silêncio: o cliente sabe que algo andou e
 * o código do pedido está ali para ele perguntar.
 */
function buildFallbackMessage(shortCode: string): string {
  return `ℹ️ O pedido ${shortCode} teve uma atualização.`
}

export function buildOrderStatusMessage(status: OrderStatus, shortCode: string): string {
  const build = NOTIFICATION_MESSAGE_BY_STATUS[status]
  if (!build) {
    notificationMessagesLog.warn('unknown_order_status', { status })
    return buildFallbackMessage(shortCode)
  }

  return build(shortCode)
}
