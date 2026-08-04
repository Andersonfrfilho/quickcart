/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Coordenada de um CEP: cache primeiro, provedor externo só no que falta.
 *
 * É esta ordem que torna o requisito "eficiente e grátis" verdadeiro em produção, e não só no
 * primeiro teste. Uma loja atende um raio finito, então o conjunto de CEPs atendidos converge em
 * semanas — depois do aquecimento, um pedido novo custa zero chamada externa, e o limite de 1 req/s
 * do Nominatim deixa de ser um risco em vez de ser contornado.
 *
 * Nunca lança. Sem coordenada, a tela mostra o endereço e não promete horário (spec §5); derrubar a
 * leitura de um pedido porque um serviço de mapa está fora seria trocar um recurso por uma falha.
 */

import type { GeocodedAddressRepositoryInterface } from '@/modules/shared/address/GeocodedAddressRepository.interface'
import type { GeocodingProviderInterface } from '@/modules/shared/address/GeocodingProvider.interface'
import type { GeocodePrecision } from '@/modules/shared/address/Address.schema'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const useCaseLog = logger.child('ResolveCepCoordinate')

type ResolveCepCoordinateDependencies = {
  readonly geocodedAddressRepository: GeocodedAddressRepositoryInterface
  readonly geocodingProvider: GeocodingProviderInterface
}

export type ResolvedCoordinate = {
  readonly latitude: number
  readonly longitude: number
  readonly precision: GeocodePrecision | string
  /** Para o log e para a tela de diagnóstico saberem se a resposta custou uma chamada externa. */
  readonly fromCache: boolean
}

export class ResolveCepCoordinateUseCase {
  constructor(private readonly dependencies: ResolveCepCoordinateDependencies) {}

  async execute(params: { readonly cep: string }): Promise<ResolvedCoordinate | undefined> {
    const cep = params.cep.replace(/\D/g, '')
    if (cep.length !== 8) return undefined

    const cached = await this.dependencies.geocodedAddressRepository.findByCep(cep)
    if (cached) {
      return {
        latitude: cached.latitude,
        longitude: cached.longitude,
        precision: cached.precision,
        fromCache: true,
      }
    }

    const geocoded = await this.dependencies.geocodingProvider.geocodeByCep(cep)
    if (!geocoded) return undefined

    /*
     * Gravar não pode derrubar a resposta.
     *
     * A coordenada já está em mãos e serve para este pedido; falhar aqui só significa que o PRÓXIMO
     * pedido deste CEP vai pagar outra chamada externa. Propagar o erro trocaria uma ineficiência por
     * uma tela que não abre.
     */
    try {
      await this.dependencies.geocodedAddressRepository.save({
        cep,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        precision: geocoded.precision,
        provider: geocoded.provider,
      })
    } catch (error: unknown) {
      useCaseLog.warn('coordinate_not_cached', { cep, error: serializeError(error) })
    }

    return {
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
      precision: geocoded.precision,
      fromCache: false,
    }
  }
}
