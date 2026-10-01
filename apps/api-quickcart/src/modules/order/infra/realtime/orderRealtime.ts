/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Emissão do `order.changed` sobre o hub compartilhado.
 *
 * Não lança: realtime é conveniência, e derrubar o PATCH que marcou um item como separado porque o
 * Redis piscou trocaria um atraso na tela por uma separação perdida. O fallback de refetch do
 * frontend existe exatamente para cobrir o evento que não chegou.
 */

import type { SseHub } from '@adatechnology/meta-whatsapp-module'
import type {
  NotifyOrderChangedParams,
  OrderRealtimeNotifierInterface,
} from '@/modules/order/domain/OrderRealtimeNotifier.interface'
import { ORDER_CHANGED_EVENT, ORDERS_CHANNEL, orderChannel } from '@/modules/order/shared/Order.constant'
import { logger } from '@/shared/logger'

const orderRealtimeLog = logger.child('OrderRealtime')

export function createOrderRealtimeNotifier(hub: SseHub): OrderRealtimeNotifierInterface {
  return {
    notifyOrderChanged({ orderId, reason }: NotifyOrderChangedParams): void {
      try {
        /*
         * Dois canais, um evento: quem está no detalhe assina o do pedido, quem está na lista assina o
         * global. Emitir só no do pedido deixaria a lista do balcão parada; só no global obrigaria a tela
         * de detalhe a receber o movimento de todos os outros pedidos da loja para descartar quase tudo.
         */
        hub.emit(orderChannel(orderId), ORDER_CHANGED_EVENT, { orderId, reason })
        hub.emit(ORDERS_CHANNEL, ORDER_CHANGED_EVENT, { orderId, reason })
      } catch (error) {
        orderRealtimeLog.warn('order_changed_emit_failed', { orderId, reason, error: String(error) })
      }
    },
  }
}
