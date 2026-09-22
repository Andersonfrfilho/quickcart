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
import { EnsureDefaultDeliveryFeeTiersUseCase } from '@/modules/order/application/use-cases/EnsureDefaultDeliveryFeeTiers.use-case'
import { DEFAULT_DELIVERY_FEE_TIERS } from '@/modules/order/shared/DefaultDeliveryFeeTiers.constant'
import type {
  DeliveryFeeTier,
  DeliveryFeeTierRepositoryInterface,
} from '@/modules/order/domain/DeliveryFeeTierRepository.interface'

class FakeTierRepository implements DeliveryFeeTierRepositoryInterface {
  public replaceAllCalls: (readonly DeliveryFeeTier[])[] = []

  constructor(private tiers: readonly DeliveryFeeTier[]) {}

  async listOrdered(): Promise<readonly DeliveryFeeTier[]> {
    return this.tiers
  }

  async replaceAll(tiers: readonly DeliveryFeeTier[]): Promise<void> {
    this.replaceAllCalls.push(tiers)
    this.tiers = tiers
  }
}

describe('EnsureDefaultDeliveryFeeTiersUseCase', () => {
  it('tabela vazia: cria as duas faixas de D4 (3km/500, 8km/1000)', async () => {
    const repository = new FakeTierRepository([])
    const useCase = new EnsureDefaultDeliveryFeeTiersUseCase({ deliveryFeeTierRepository: repository })

    await useCase.execute()

    expect(repository.replaceAllCalls).toEqual([DEFAULT_DELIVERY_FEE_TIERS])
  })

  it('tabela com qualquer faixa existente: não mexe', async () => {
    const custom: DeliveryFeeTier[] = [{ maxDistanceKm: 5, feeInCents: 300 }]
    const repository = new FakeTierRepository(custom)
    const useCase = new EnsureDefaultDeliveryFeeTiersUseCase({ deliveryFeeTierRepository: repository })

    await useCase.execute()

    expect(repository.replaceAllCalls).toEqual([])
    expect(await repository.listOrdered()).toEqual(custom)
  })

  it('idempotente: rodar 2x não duplica nem sobrescreve o que a primeira rodada criou', async () => {
    const repository = new FakeTierRepository([])
    const useCase = new EnsureDefaultDeliveryFeeTiersUseCase({ deliveryFeeTierRepository: repository })

    await useCase.execute()
    await useCase.execute()

    expect(repository.replaceAllCalls.length).toBe(1)
    expect(await repository.listOrdered()).toEqual(DEFAULT_DELIVERY_FEE_TIERS)
  })
})
