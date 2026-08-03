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
import { geocodedAddresses } from '@/infra/database/schema'
import type {
  GeocodedAddressRecord,
  GeocodedAddressRepositoryInterface,
  SaveGeocodedAddressParams,
} from '@/modules/shared/address/GeocodedAddressRepository.interface'

/** Sempre `00000000`, sem hífen: o CEP é chave primária, e duas grafias do mesmo CEP seriam duas linhas. */
function normalizeCep(cep: string): string {
  return cep.replace(/\D/g, '')
}

export class DrizzleGeocodedAddressRepository implements GeocodedAddressRepositoryInterface {
  async findByCep(cep: string): Promise<GeocodedAddressRecord | undefined> {
    const [row] = await db
      .select()
      .from(geocodedAddresses)
      .where(eq(geocodedAddresses.cep, normalizeCep(cep)))
      .limit(1)

    if (!row) return undefined

    return {
      cep: row.cep,
      // `numeric` do Postgres chega como string no driver — Number() aqui, e não no chamador, para
      // ninguém fazer conta com string e receber concatenação silenciosa.
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      precision: row.precision,
      provider: row.provider,
      resolvedAt: row.resolvedAt,
    }
  }

  async save(params: SaveGeocodedAddressParams): Promise<void> {
    await db
      .insert(geocodedAddresses)
      .values({
        cep: normalizeCep(params.cep),
        latitude: String(params.latitude),
        longitude: String(params.longitude),
        precision: params.precision,
        provider: params.provider,
      })
      .onConflictDoUpdate({
        target: geocodedAddresses.cep,
        set: {
          latitude: String(params.latitude),
          longitude: String(params.longitude),
          precision: params.precision,
          provider: params.provider,
        },
      })
  }
}
