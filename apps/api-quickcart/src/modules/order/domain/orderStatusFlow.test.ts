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

import { DELIVERY_TYPE, ORDER_STATUS } from '@/modules/order/shared/Order.constant'

import { ORDER_ACTOR, allowedNextStatuses, canTransitionTo } from './orderStatusFlow'

const DELIVERY = { deliveryType: DELIVERY_TYPE.DELIVERY } as const

describe('allowedNextStatuses por ator', () => {
  it('a loja cancela um pedido já separado', () => {
    const next = allowedNextStatuses({ ...DELIVERY, status: ORDER_STATUS.SEPARATED, actor: ORDER_ACTOR.STAFF })

    expect(next).toContain(ORDER_STATUS.CANCELLED)
  })

  it('sem ator declarado a esteira do painel não muda', () => {
    const next = allowedNextStatuses({ ...DELIVERY, status: ORDER_STATUS.SEPARATED })

    expect(next).toContain(ORDER_STATUS.CANCELLED)
  })

  it('o cliente não cancela depois de a sacola estar separada', () => {
    const next = allowedNextStatuses({ ...DELIVERY, status: ORDER_STATUS.SEPARATED, actor: ORDER_ACTOR.CUSTOMER })

    expect(next).not.toContain(ORDER_STATUS.CANCELLED)
    expect(
      canTransitionTo({
        ...DELIVERY,
        status: ORDER_STATUS.SEPARATED,
        actor: ORDER_ACTOR.CUSTOMER,
        nextStatus: ORDER_STATUS.CANCELLED,
      }),
    ).toBe(false)
  })

  /** Antes da sacola fechada o custo ainda não foi gasto: desistir ali continua sendo do cliente. */
  it('o cliente ainda cancela enquanto a separação corre', () => {
    const next = allowedNextStatuses({ ...DELIVERY, status: ORDER_STATUS.PREPARING, actor: ORDER_ACTOR.CUSTOMER })

    expect(next).toContain(ORDER_STATUS.CANCELLED)
  })

  it('o resto da esteira do cliente segue igual', () => {
    const next = allowedNextStatuses({ ...DELIVERY, status: ORDER_STATUS.SEPARATED, actor: ORDER_ACTOR.CUSTOMER })

    expect(next).toContain(ORDER_STATUS.OUT_FOR_DELIVERY)
  })
})
