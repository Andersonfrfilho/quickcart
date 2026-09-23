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

import { SetOrderItemPickedUseCase } from '@/modules/order/application/use-cases/SetOrderItemPicked.use-case'
import type { OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import { ORDER_STATUS } from '@/modules/order/shared/Order.constant'

const ORDER_ID = 'order-1'
const ITEM_ID = 'item-1'

function buildUseCase(status: string) {
  const pickedCalls: string[] = []

  const detail = {
    order: { id: ORDER_ID, status },
    items: [{ id: ITEM_ID, unavailableAt: null, pickedAt: null }],
  }

  const orderRepository = {
    findDetailById: async () => detail,
    setItemPicked: async (params: { itemId: string }) => {
      pickedCalls.push(params.itemId)
      return detail
    },
    setAllItemsPicked: async () => detail,
  } as unknown as OrderRepositoryInterface

  return { useCase: new SetOrderItemPickedUseCase({ orderRepository }), pickedCalls }
}

describe('SetOrderItemPickedUseCase', () => {
  /*
   * A trava do servidor divergia do frontend: `resolvePickingState` já liberava este estado, então a
   * tela deixava tocar, a API recusava e o checkbox voltava sozinho — sem explicar nada a quem estava
   * de pé no corredor com a sacola na mão.
   */
  it('deixa marcar item enquanto o pedido espera a decisão do cliente sobre a falta', async () => {
    const { useCase, pickedCalls } = buildUseCase(ORDER_STATUS.AWAITING_CUSTOMER_DECISION)

    await useCase.execute({ orderId: ORDER_ID, itemId: ITEM_ID, picked: true })

    expect(pickedCalls).toEqual([ITEM_ID])
  })

  it('continua recusando pedido que já saiu da loja', async () => {
    const { useCase } = buildUseCase(ORDER_STATUS.OUT_FOR_DELIVERY)

    await expect(useCase.execute({ orderId: ORDER_ID, itemId: ITEM_ID, picked: true })).rejects.toThrow()
  })
})
