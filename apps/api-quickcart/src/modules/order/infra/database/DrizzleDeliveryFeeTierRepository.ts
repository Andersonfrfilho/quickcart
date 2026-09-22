/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * `replaceAll` roda delete + insert numa única transação: o painel substitui a lista inteira
 * (design.md "Trade-offs aceitos"), então não existe upsert por linha — uma leitura no meio da
 * transação nunca vê a tabela vazia nem uma mistura de listas.
 */

import { asc } from 'drizzle-orm'
import { db } from '@/infra/database/connection'
import { deliveryFeeSettings, deliveryFeeTiers } from '@/infra/database/schema'
import { generateId } from '@/shared/id'
import type {
  DeliveryFeeTier,
  DeliveryFeeTierRepositoryInterface,
} from '@/modules/order/domain/DeliveryFeeTierRepository.interface'

export class DrizzleDeliveryFeeTierRepository implements DeliveryFeeTierRepositoryInterface {
  async listOrdered(): Promise<readonly DeliveryFeeTier[]> {
    const rows = await db
      .select()
      .from(deliveryFeeTiers)
      .orderBy(asc(deliveryFeeTiers.maxDistanceKm))

    return rows.map((row) => ({
      // `numeric` chega como string no driver — convertido aqui, não no chamador (mesmo padrão do
      // `DrizzleGeocodedAddressRepository`).
      maxDistanceKm: Number(row.maxDistanceKm),
      feeInCents: row.feeInCents,
    }))
  }

  async replaceAll(tiers: readonly DeliveryFeeTier[]): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(deliveryFeeTiers)
      await tx.insert(deliveryFeeSettings).values({ id: 1 }).onConflictDoNothing()
      if (tiers.length === 0) return

      await tx.insert(deliveryFeeTiers).values(
        tiers.map((tier) => ({
          id: generateId(),
          maxDistanceKm: String(tier.maxDistanceKm),
          feeInCents: tier.feeInCents,
        })),
      )
    })
  }

  async hasBeenConfigured(): Promise<boolean> {
    const rows = await db.select({ id: deliveryFeeSettings.id }).from(deliveryFeeSettings).limit(1)
    return rows.length > 0
  }

  async markConfigured(): Promise<void> {
    await db.insert(deliveryFeeSettings).values({ id: 1 }).onConflictDoNothing()
  }
}
