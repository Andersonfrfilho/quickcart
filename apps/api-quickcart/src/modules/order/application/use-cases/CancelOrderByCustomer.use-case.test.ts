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

import {
  CancelOrderByCustomerUseCase,
  CUSTOMER_CANCEL_SKIP_REASON,
} from './CancelOrderByCustomer.use-case'

const CUSTOMER_ID = 'customer-1'

function buildHarness(params: { readonly status: string; readonly customerId?: string }) {
  const order = {
    id: 'order-1',
    shortCode: 'QC-1008',
    customerId: params.customerId ?? CUSTOMER_ID,
    status: params.status,
    deliveryType: DELIVERY_TYPE.DELIVERY,
    deliveryFailureReason: null,
  }
  const executed: Array<{ status: string; actor?: string }> = []

  const useCase = new CancelOrderByCustomerUseCase({
    orderRepository: {
      findLastByCustomer: async () => order,
      findById: async () => order,
    } as never,
    updateOrderStatusUseCase: {
      execute: async (input: { status: string; actor?: string }) => {
        executed.push(input)
        return { order: { ...order, status: ORDER_STATUS.CANCELLED } }
      },
    } as never,
  })

  return { useCase, executed }
}

describe('CancelOrderByCustomerUseCase', () => {
  it('cancela enquanto a separação corre, declarando que quem pede é o cliente', async () => {
    const harness = buildHarness({ status: ORDER_STATUS.PREPARING })

    const result = await harness.useCase.execute({ customerId: CUSTOMER_ID })

    expect(result.cancelled).toBe(true)
    expect(harness.executed).toHaveLength(1)
    expect(harness.executed[0]?.actor).toBe('customer')
  })

  it('recusa quando a sacola já está separada, e não grava nada', async () => {
    const harness = buildHarness({ status: ORDER_STATUS.SEPARATED })

    const result = await harness.useCase.execute({ customerId: CUSTOMER_ID })

    expect(result).toMatchObject({ cancelled: false, reason: CUSTOMER_CANCEL_SKIP_REASON.TOO_LATE })
    expect(harness.executed).toEqual([])
  })

  it('recusa quando o pedido já saiu para entrega', async () => {
    const harness = buildHarness({ status: ORDER_STATUS.OUT_FOR_DELIVERY })

    const result = await harness.useCase.execute({ customerId: CUSTOMER_ID })

    expect(result).toMatchObject({ cancelled: false, reason: CUSTOMER_CANCEL_SKIP_REASON.TOO_LATE })
  })

  it('não tem o que cancelar num pedido já concluído', async () => {
    const harness = buildHarness({ status: ORDER_STATUS.COMPLETED })

    const result = await harness.useCase.execute({ customerId: CUSTOMER_ID })

    expect(result).toMatchObject({ cancelled: false, reason: CUSTOMER_CANCEL_SKIP_REASON.NOTHING_TO_CANCEL })
  })

  /** O id trafega pelo aparelho do cliente: um payload forjado não pode cancelar pedido alheio. */
  it('recusa pedido de outro cliente sem dizer que ele existe', async () => {
    const harness = buildHarness({ status: ORDER_STATUS.PREPARING, customerId: 'outro-cliente' })

    const result = await harness.useCase.execute({ customerId: CUSTOMER_ID, orderId: 'order-1' })

    expect(result).toMatchObject({ cancelled: false, reason: CUSTOMER_CANCEL_SKIP_REASON.NOTHING_TO_CANCEL })
    expect(harness.executed).toEqual([])
  })

  it('dryRun responde que daria, sem gravar', async () => {
    const harness = buildHarness({ status: ORDER_STATUS.PREPARING })

    const result = await harness.useCase.execute({ customerId: CUSTOMER_ID, dryRun: true })

    expect(result).toMatchObject({ cancelled: false, reason: CUSTOMER_CANCEL_SKIP_REASON.WOULD_CANCEL })
    expect(harness.executed).toEqual([])
  })
})
