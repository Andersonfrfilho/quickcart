/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Coordenada de um CEP: memória do processo primeiro, cache em banco depois, cache NEGATIVO antes
 * do provedor, provedor externo só no que sobrar.
 *
 * É esta ordem que torna o requisito "eficiente e grátis" verdadeiro em produção, e não só no
 * primeiro teste. Uma loja atende um raio finito, então o conjunto de CEPs atendidos converge em
 * semanas — depois do aquecimento, um pedido novo custa zero chamada externa, e o limite de 1 req/s
 * do Nominatim deixa de ser um risco em vez de ser contornado.
 *
 * O cache NEGATIVO (T1.4, spec §3.5) existe porque a rota pública de cotação pode ser chamada com
 * qualquer CEP, inclusive um que o Nominatim nunca resolve — sem ele, cada tentativa desse CEP
 * gastaria uma chamada ao provedor, e é o jeito mais fácil de estourar 1 req/s numa rota pública.
 *
 * Nunca lança. Sem coordenada, a tela mostra o endereço e não promete horário (spec §5); derrubar a
 * leitura de um pedido porque um serviço de mapa está fora seria trocar um recurso por uma falha.
 */

import type { GeocodedAddressRepositoryInterface } from '@/modules/shared/address/GeocodedAddressRepository.interface'
import type { GeocodeFailureRepositoryInterface } from '@/modules/shared/address/GeocodeFailureRepository.interface'
import {
  GEOCODE_OUTCOME_KIND,
  type GeocodingProviderInterface,
} from '@/modules/shared/address/GeocodingProvider.interface'
import type { GeocodePrecision } from '@/modules/shared/address/Address.schema'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'
import { maskCep } from '@/shared/maskCep'

const useCaseLog = logger.child('ResolveCepCoordinate')

/** 24h — mesma janela do cache negativo (spec §3.5). */
export const GEOCODE_FAILURE_TTL_MS = 24 * 60 * 60 * 1000

/** Teto da memória do processo: a rota pública aceita qualquer CEP, e um Map sem teto vira vazamento. */
export const COORDINATE_MEMORY_CACHE_MAX_ENTRIES = 5000

type ResolveCepCoordinateDependencies = {
  readonly geocodedAddressRepository: GeocodedAddressRepositoryInterface
  readonly geocodingProvider: GeocodingProviderInterface
  readonly geocodeFailureRepository?: GeocodeFailureRepositoryInterface
  /** CEP da loja: nunca vai para o cache negativo — sem ele, toda entrega some por 24h. */
  readonly storeCep?: string | undefined
  /** Injetável para teste; produção usa o relógio real. */
  readonly now?: () => Date
}

export type ResolvedCoordinate = {
  readonly latitude: number
  readonly longitude: number
  readonly precision: GeocodePrecision | string
  /** Para o log e para a tela de diagnóstico saberem se a resposta custou uma chamada externa. */
  readonly fromCache: boolean
}

export class ResolveCepCoordinateUseCase {
  /**
   * Memória do processo: o CEP da loja se repete em toda cotação, então depois da primeira
   * resolução nem o cache em banco precisa ser consultado de novo (design.md, "Coordenada da
   * loja... em memória"). Vale para qualquer CEP, não só o da loja — a chave é o CEP normalizado.
   */
  private readonly memoryCache = new Map<string, ResolvedCoordinate>()
  /** Mesmo CEP em paralelo espera a mesma resolução, em vez de gastar duas vagas do 1 req/s. */
  private readonly inFlight = new Map<string, Promise<ResolvedCoordinate | undefined>>()
  private readonly storeCepDigits: string | undefined

  constructor(private readonly dependencies: ResolveCepCoordinateDependencies) {
    this.storeCepDigits = dependencies.storeCep?.replace(/\D/g, '')
  }

  async execute(params: { readonly cep: string }): Promise<ResolvedCoordinate | undefined> {
    const cep = params.cep.replace(/\D/g, '')
    if (cep.length !== 8) return undefined

    const memoized = this.memoryCache.get(cep)
    if (memoized) {
      this.remember(cep, memoized)
      return { ...memoized, fromCache: true }
    }

    const pending = this.inFlight.get(cep)
    if (pending) return pending

    const resolution = this.resolve(cep).finally(() => this.inFlight.delete(cep))
    this.inFlight.set(cep, resolution)
    return resolution
  }

  /** LRU simples: o Map preserva ordem de inserção, então reinserir marca como recente e o primeiro é o mais antigo. */
  private remember(cep: string, resolved: ResolvedCoordinate): void {
    this.memoryCache.delete(cep)
    this.memoryCache.set(cep, resolved)
    if (this.memoryCache.size <= COORDINATE_MEMORY_CACHE_MAX_ENTRIES) return
    const oldest = this.memoryCache.keys().next().value
    if (oldest !== undefined) this.memoryCache.delete(oldest)
  }

  private async resolve(cep: string): Promise<ResolvedCoordinate | undefined> {
    const cached = await this.dependencies.geocodedAddressRepository.findByCep(cep)
    if (cached) {
      const resolved: ResolvedCoordinate = {
        latitude: cached.latitude,
        longitude: cached.longitude,
        precision: cached.precision,
        fromCache: true,
      }
      this.remember(cep, resolved)
      return resolved
    }

    const isStoreCep = cep === this.storeCepDigits
    if (!isStoreCep && (await this.hasRecentFailure(cep))) return undefined

    const outcome = await this.dependencies.geocodingProvider.geocodeByCep(cep)
    if (outcome.kind === GEOCODE_OUTCOME_KIND.TRANSIENT_ERROR) return undefined
    if (outcome.kind === GEOCODE_OUTCOME_KIND.NOT_FOUND) {
      if (!isStoreCep) await this.recordFailure(cep)
      return undefined
    }
    const geocoded = outcome.coordinate

    await this.clearFailure(cep)

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
      useCaseLog.warn('coordinate_not_cached', { cep: maskCep(cep), error: serializeError(error) })
    }

    const resolved: ResolvedCoordinate = {
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
      precision: geocoded.precision,
      fromCache: false,
    }
    this.remember(cep, resolved)
    return resolved
  }

  private async hasRecentFailure(cep: string): Promise<boolean> {
    const repository = this.dependencies.geocodeFailureRepository
    if (!repository) return false

    const failure = await repository.findByCep(cep)
    if (!failure) return false

    const now = this.dependencies.now?.() ?? new Date()
    const elapsedMs = now.getTime() - failure.failedAt.getTime()
    return elapsedMs < GEOCODE_FAILURE_TTL_MS
  }

  private async recordFailure(cep: string): Promise<void> {
    const repository = this.dependencies.geocodeFailureRepository
    if (!repository) return

    const now = this.dependencies.now?.() ?? new Date()
    try {
      await repository.save({ cep, failedAt: now })
    } catch (error: unknown) {
      useCaseLog.warn('failure_not_cached', { cep: maskCep(cep), error: serializeError(error) })
    }
  }

  private async clearFailure(cep: string): Promise<void> {
    const repository = this.dependencies.geocodeFailureRepository
    if (!repository) return

    try {
      await repository.remove(cep)
    } catch (error: unknown) {
      useCaseLog.warn('failure_not_cleared', { cep: maskCep(cep), error: serializeError(error) })
    }
  }
}
