/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O que um fake não prova: o CHECK do banco recusando taxa negativa mesmo que a validação de
 * aplicação falhe, e que `replaceAll` de fato substitui a lista inteira dentro de uma transação.
 */

import { afterAll, afterEach, describe, expect, test } from 'bun:test'

import { db } from '@/infra/database/connection'
import { deliveryFeeSettings, deliveryFeeTiers } from '@/infra/database/schema'
import { generateId } from '@/shared/id'
import { DrizzleDeliveryFeeTierRepository } from '@/modules/order/infra/database/DrizzleDeliveryFeeTierRepository'

const repository = new DrizzleDeliveryFeeTierRepository()

async function limpar(): Promise<void> {
  await db.delete(deliveryFeeTiers)
  await db.delete(deliveryFeeSettings)
}

afterEach(limpar)
afterAll(limpar)

describe('DrizzleDeliveryFeeTierRepository', () => {
  test('listOrdered ordena por maxDistanceKm crescente independentemente da ordem de inserção', async () => {
    await repository.replaceAll([
      { maxDistanceKm: 8, feeInCents: 1000 },
      { maxDistanceKm: 3, feeInCents: 500 },
    ])

    const tiers = await repository.listOrdered()

    expect(tiers).toEqual([
      { maxDistanceKm: 3, feeInCents: 500 },
      { maxDistanceKm: 8, feeInCents: 1000 },
    ])
  })

  test('replaceAll substitui a lista inteira, sem misturar com a anterior', async () => {
    await repository.replaceAll([{ maxDistanceKm: 3, feeInCents: 500 }])

    await repository.replaceAll([
      { maxDistanceKm: 5, feeInCents: 700 },
      { maxDistanceKm: 10, feeInCents: 1500 },
    ])

    const tiers = await repository.listOrdered()
    expect(tiers).toEqual([
      { maxDistanceKm: 5, feeInCents: 700 },
      { maxDistanceKm: 10, feeInCents: 1500 },
    ])
  })

  test('replaceAll com lista vazia desliga a entrega (tabela fica vazia)', async () => {
    await repository.replaceAll([{ maxDistanceKm: 3, feeInCents: 500 }])

    await repository.replaceAll([])

    expect(await repository.listOrdered()).toEqual([])
  })

  test('replaceAll grava o marcador, mesmo com lista vazia; markConfigured é idempotente', async () => {
    expect(await repository.hasBeenConfigured()).toBe(false)

    await repository.replaceAll([])
    expect(await repository.hasBeenConfigured()).toBe(true)

    await repository.markConfigured()
    await repository.replaceAll([{ maxDistanceKm: 3, feeInCents: 500 }])
    expect(await repository.hasBeenConfigured()).toBe(true)
  })

  test('o CHECK do banco recusa fee_in_cents negativo mesmo sem passar pela validação de aplicação', async () => {
    await expect(
      (async () => db.insert(deliveryFeeTiers).values({ id: generateId(), maxDistanceKm: '3.00', feeInCents: -1 }))(),
    ).rejects.toThrow()
  })

  test('o CHECK do banco recusa max_distance_km <= 0', async () => {
    await expect(
      (async () => db.insert(deliveryFeeTiers).values({ id: generateId(), maxDistanceKm: '0.00', feeInCents: 500 }))(),
    ).rejects.toThrow()
  })

  test('UNIQUE(max_distance_km) recusa duas faixas com o mesmo teto', async () => {
    await db.insert(deliveryFeeTiers).values({ id: generateId(), maxDistanceKm: '3.00', feeInCents: 500 })

    await expect(
      (async () => db.insert(deliveryFeeTiers).values({ id: generateId(), maxDistanceKm: '3.00', feeInCents: 900 }))(),
    ).rejects.toThrow()
  })
})
