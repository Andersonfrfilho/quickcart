/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { describe, expect, it } from 'bun:test'
import type { SseHub } from '@adatechnology/meta-whatsapp-module'

import { createOrderRealtimeNotifier } from './orderRealtime'
import { ORDER_CHANGE_REASON } from '@/modules/order/domain/OrderRealtimeNotifier.interface'
import { ORDER_CHANGED_EVENT, ORDERS_CHANNEL, orderChannel } from '@/modules/order/shared/Order.constant'

const ORDER_ID = 'order-abc'

function buildHubSpy() {
  const emissions: { channel: string; event: string; payload: Record<string, unknown> }[] = []
  const hub = {
    emit(channel: string, event: string, payload: Record<string, unknown>) {
      emissions.push({ channel, event, payload })
    },
  } as unknown as SseHub
  return { hub, emissions }
}

describe('createOrderRealtimeNotifier', () => {
  it('avisa quem está no detalhe e quem está na lista, com o mesmo evento', () => {
    const { hub, emissions } = buildHubSpy()

    createOrderRealtimeNotifier(hub).notifyOrderChanged({
      orderId: ORDER_ID,
      reason: ORDER_CHANGE_REASON.CUSTOMER_DECISION,
    })

    expect(emissions).toEqual([
      {
        channel: orderChannel(ORDER_ID),
        event: ORDER_CHANGED_EVENT,
        payload: { orderId: ORDER_ID, reason: ORDER_CHANGE_REASON.CUSTOMER_DECISION },
      },
      {
        channel: ORDERS_CHANNEL,
        event: ORDER_CHANGED_EVENT,
        payload: { orderId: ORDER_ID, reason: ORDER_CHANGE_REASON.CUSTOMER_DECISION },
      },
    ])
  })

  /**
   * Realtime é conveniência: derrubar o PATCH que marcou um item como separado porque o Redis piscou
   * trocaria um atraso na tela por uma separação perdida.
   */
  it('não propaga falha do hub para quem chamou', () => {
    const hub = {
      emit() {
        throw new Error('redis indisponível')
      },
    } as unknown as SseHub

    expect(() =>
      createOrderRealtimeNotifier(hub).notifyOrderChanged({
        orderId: ORDER_ID,
        reason: ORDER_CHANGE_REASON.STATUS,
      }),
    ).not.toThrow()
  })
})
