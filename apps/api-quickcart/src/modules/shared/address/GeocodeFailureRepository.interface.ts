/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cache negativo por CEP (T1.4): ao contrário de `GeocodedAddressRepositoryInterface`, aqui o
 * registro tem TTL — por isso existe `remove`, chamado quando uma geocodificação mais tarde funciona.
 */

export type GeocodeFailureRecord = {
  readonly cep: string
  readonly failedAt: Date
}

export interface GeocodeFailureRepositoryInterface {
  findByCep(cep: string): Promise<GeocodeFailureRecord | undefined>
  save(params: { readonly cep: string; readonly failedAt: Date }): Promise<void>
  remove(cep: string): Promise<void>
}
