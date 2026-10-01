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
import { ORDER_STATUS } from '@/shared/api/api.types'
import { resolveOrderRefetchInterval } from './orderRefetchPolicy'

describe('resolveOrderRefetchInterval', () => {
  it('não repete enquanto o stream está de pé, nem no estado mais volátil', () => {
    expect(
      resolveOrderRefetchInterval({
        status: ORDER_STATUS.AWAITING_CUSTOMER_DECISION,
        isRealtimeConnected: true,
      }),
    ).toBe(false)
  })

  it('pergunta de poucos em poucos segundos quando a decisão está com o cliente e o stream caiu', () => {
    expect(
      resolveOrderRefetchInterval({
        status: ORDER_STATUS.AWAITING_CUSTOMER_DECISION,
        isRealtimeConnected: false,
      }),
    ).toBe(5_000)
  })

  it('espaça o intervalo nos estados que só outro operador muda', () => {
    expect(
      resolveOrderRefetchInterval({ status: ORDER_STATUS.PREPARING, isRealtimeConnected: false }),
    ).toBe(30_000)
  })

  it('para de perguntar em pedido que já terminou', () => {
    for (const status of [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED]) {
      expect(resolveOrderRefetchInterval({ status, isRealtimeConnected: false })).toBe(false)
    }
  })

  it('não pergunta antes de haver pedido carregado', () => {
    expect(resolveOrderRefetchInterval({ status: undefined, isRealtimeConnected: false })).toBe(false)
  })
})
