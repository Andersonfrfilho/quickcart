/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O cache de coordenada por CEP, em Postgres e não em Redis.
 *
 * CEP → coordenada não expira: a rua não se move. Cache com TTL devolveria a mesma resposta da mesma
 * API depois de esquecer de graça, e é justamente o esquecimento que colocaria a loja de volta contra
 * o limite de 1 req/s do Nominatim. Aqui, o conjunto de CEPs atendidos converge e para de custar.
 */

import type { GeocodePrecision } from '@/modules/shared/address/Address.schema'

export type GeocodedAddressRecord = {
  readonly cep: string
  readonly latitude: number
  readonly longitude: number
  readonly precision: GeocodePrecision | string
  readonly provider: string
  readonly resolvedAt: Date
}

export type SaveGeocodedAddressParams = {
  readonly cep: string
  readonly latitude: number
  readonly longitude: number
  readonly precision: string
  readonly provider: string
}

export interface GeocodedAddressRepositoryInterface {
  findByCep(cep: string): Promise<GeocodedAddressRecord | undefined>
  /**
   * Grava ou atualiza. Duas requisições simultâneas com o mesmo CEP novo geocodificam duas vezes (o
   * cache não é lock), e a segunda sobrescreve com o mesmo valor — desperdício de uma chamada, nunca
   * erro. Um lock aqui custaria mais que a chamada que ele evita.
   */
  save(params: SaveGeocodedAddressParams): Promise<void>
}
