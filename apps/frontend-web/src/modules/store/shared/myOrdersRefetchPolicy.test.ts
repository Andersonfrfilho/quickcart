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
import { resolveMyOrdersRefetchInterval } from './myOrdersRefetchPolicy'

describe('resolveMyOrdersRefetchInterval', () => {
  it('não pergunta nada quando só há histórico encerrado', () => {
    expect(
      resolveMyOrdersRefetchInterval({
        statuses: [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED, ORDER_STATUS.DELIVERY_FAILED],
      }),
    ).toBe(false)
  })

  it('aperta o intervalo quando há entrega a caminho', () => {
    for (const status of [
      ORDER_STATUS.OUT_FOR_DELIVERY,
      ORDER_STATUS.IN_TRANSIT,
      ORDER_STATUS.ARRIVED_AT_CUSTOMER,
    ]) {
      expect(resolveMyOrdersRefetchInterval({ statuses: [status] })).toBe(15_000)
    }
  })

  it('a entrega a caminho manda, mesmo cercada de pedidos antigos', () => {
    expect(
      resolveMyOrdersRefetchInterval({
        statuses: [ORDER_STATUS.COMPLETED, ORDER_STATUS.COMPLETED, ORDER_STATUS.IN_TRANSIT],
      }),
    ).toBe(15_000)
  })

  it('espaça o intervalo enquanto o pedido ainda está na loja', () => {
    expect(resolveMyOrdersRefetchInterval({ statuses: [ORDER_STATUS.PREPARING] })).toBe(60_000)
  })

  it('não pergunta antes de a lista existir, nem com a lista vazia', () => {
    expect(resolveMyOrdersRefetchInterval({ statuses: undefined })).toBe(false)
    expect(resolveMyOrdersRefetchInterval({ statuses: [] })).toBe(false)
  })
})
