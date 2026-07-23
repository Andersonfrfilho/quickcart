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

const NOTIFICATION_MESSAGE_BY_STATUS: Record<OrderStatus, (shortCode: string) => string> = {
  [ORDER_STATUS.PENDING_CONFIRMATION]: (shortCode) => `⏳ Pedido ${shortCode} recebido e aguardando confirmação.`,
  [ORDER_STATUS.CONFIRMED]: (shortCode) => `✅ Pedido ${shortCode} confirmado! Já vamos começar a separar.`,
  [ORDER_STATUS.PREPARING]: (shortCode) => `🛒 Pedido ${shortCode} está sendo preparado.`,
  [ORDER_STATUS.OUT_FOR_DELIVERY]: (shortCode) => `🚚 Pedido ${shortCode} saiu para entrega!`,
  [ORDER_STATUS.READY_FOR_PICKUP]: (shortCode) => `📦 Pedido ${shortCode} está pronto para retirada.`,
  [ORDER_STATUS.COMPLETED]: (shortCode) => `🎉 Pedido ${shortCode} concluído. Obrigado pela preferência!`,
  [ORDER_STATUS.CANCELLED]: (shortCode) => `❌ Pedido ${shortCode} foi cancelado.`,
}

export function buildOrderStatusMessage(status: OrderStatus, shortCode: string): string {
  return NOTIFICATION_MESSAGE_BY_STATUS[status](shortCode)
}
