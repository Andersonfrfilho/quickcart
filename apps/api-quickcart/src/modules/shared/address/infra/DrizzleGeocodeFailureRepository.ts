/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { eq } from 'drizzle-orm'
import { db } from '@/infra/database/connection'
import { geocodeFailures } from '@/infra/database/schema'
import type {
  GeocodeFailureRecord,
  GeocodeFailureRepositoryInterface,
} from '@/modules/shared/address/GeocodeFailureRepository.interface'

function normalizeCep(cep: string): string {
  return cep.replace(/\D/g, '')
}

export class DrizzleGeocodeFailureRepository implements GeocodeFailureRepositoryInterface {
  async findByCep(cep: string): Promise<GeocodeFailureRecord | undefined> {
    const [row] = await db
      .select()
      .from(geocodeFailures)
      .where(eq(geocodeFailures.cep, normalizeCep(cep)))
      .limit(1)

    if (!row) return undefined
    return { cep: row.cep, failedAt: row.failedAt }
  }

  async save(params: { readonly cep: string; readonly failedAt: Date }): Promise<void> {
    const cep = normalizeCep(params.cep)
    await db
      .insert(geocodeFailures)
      .values({ cep, failedAt: params.failedAt })
      .onConflictDoUpdate({ target: geocodeFailures.cep, set: { failedAt: params.failedAt } })
  }

  async remove(cep: string): Promise<void> {
    await db.delete(geocodeFailures).where(eq(geocodeFailures.cep, normalizeCep(cep)))
  }
}
