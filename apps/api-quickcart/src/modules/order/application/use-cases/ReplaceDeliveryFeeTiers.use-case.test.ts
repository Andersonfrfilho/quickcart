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
import type {
  DeliveryFeeTier,
  DeliveryFeeTierRepositoryInterface,
} from '@/modules/order/domain/DeliveryFeeTierRepository.interface'
import { ReplaceDeliveryFeeTiersUseCase } from './ReplaceDeliveryFeeTiers.use-case'

function buildFakeRepository(initialTiers: readonly DeliveryFeeTier[]) {
  let tiers = initialTiers
  const replaceAllCalls: (readonly DeliveryFeeTier[])[] = []
  const repository: DeliveryFeeTierRepositoryInterface = {
    async listOrdered() {
      return tiers
    },
    async replaceAll(next) {
      replaceAllCalls.push(next)
      tiers = next
    },
  }
  return { repository, replaceAllCalls }
}

describe('ReplaceDeliveryFeeTiersUseCase', () => {
  it('substitui a lista e devolve a nova', async () => {
    const oldTiers: readonly DeliveryFeeTier[] = [{ maxDistanceKm: 5, feeInCents: 600 }]
    const newTiers: readonly DeliveryFeeTier[] = [
      { maxDistanceKm: 3, feeInCents: 500 },
      { maxDistanceKm: 8, feeInCents: 1000 },
    ]
    const { repository, replaceAllCalls } = buildFakeRepository(oldTiers)
    const useCase = new ReplaceDeliveryFeeTiersUseCase({ deliveryFeeTierRepository: repository })

    const result = await useCase.execute({ tiers: newTiers, actorUserId: 'user-1' })

    expect(result).toEqual(newTiers)
    expect(replaceAllCalls).toEqual([newTiers])
  })

  it('aceita lista vazia (desliga a entrega)', async () => {
    const { repository, replaceAllCalls } = buildFakeRepository([{ maxDistanceKm: 5, feeInCents: 600 }])
    const useCase = new ReplaceDeliveryFeeTiersUseCase({ deliveryFeeTierRepository: repository })

    const result = await useCase.execute({ tiers: [], actorUserId: 'user-1' })

    expect(result).toEqual([])
    expect(replaceAllCalls).toEqual([[]])
  })

  it('lê a lista antiga antes de trocar, para a trilha de auditoria', async () => {
    const oldTiers: readonly DeliveryFeeTier[] = [{ maxDistanceKm: 5, feeInCents: 600 }]
    const listOrderedCalls: number[] = []
    let listOrderedCallCount = 0
    const repository: DeliveryFeeTierRepositoryInterface = {
      async listOrdered() {
        listOrderedCallCount += 1
        listOrderedCalls.push(listOrderedCallCount)
        return oldTiers
      },
      async replaceAll() {},
    }
    const useCase = new ReplaceDeliveryFeeTiersUseCase({ deliveryFeeTierRepository: repository })

    await useCase.execute({ tiers: [], actorUserId: 'user-1' })

    expect(listOrderedCalls).toEqual([1])
  })
})
