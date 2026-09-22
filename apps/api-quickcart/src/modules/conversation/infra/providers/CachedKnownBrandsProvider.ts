/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Marca de catálogo é cadastro do lojista, muda pouco — e o parser roda a cada
 * lista recebida. Sem cache, toda mensagem de texto dispararia um SELECT DISTINCT
 * brand. 10 minutos é folga suficiente para uma marca nova aparecer sem exigir
 * reinício, sem bater no banco a cada mensagem.
 */

import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { KnownBrandsProvider } from '@/modules/conversation/application/providers/KnownBrandsProvider.interface'
import { normalizeBrand } from '@/modules/conversation/shared/normalizeBrand'
import { LOG_EVENTS } from '@/shared/constants/log-events.constant'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const KNOWN_BRANDS_CACHE_TTL_MS = 10 * 60 * 1000

const knownBrandsLog = logger.child('CachedKnownBrandsProvider')

export class CachedKnownBrandsProvider implements KnownBrandsProvider {
  private cachedBrands: ReadonlySet<string> | undefined
  private cachedAt: number | undefined

  constructor(private readonly productRepository: ProductRepositoryInterface) {}

  async listKnownBrands(): Promise<ReadonlySet<string>> {
    if (this.isCacheFresh()) return this.cachedBrands!

    try {
      const brands = await this.productRepository.listDistinctBrands()
      const normalizedBrands = new Set(brands.map(normalizeBrand))
      this.cachedBrands = normalizedBrands
      this.cachedAt = Date.now()
      return normalizedBrands
    } catch (error) {
      /** Falha aqui nunca pode derrubar o parser — só perde o reconhecimento de marca desta vez. */
      knownBrandsLog.warn(LOG_EVENTS.CONVERSATION_KNOWN_BRANDS_UNAVAILABLE, { error: serializeError(error) })
      return new Set()
    }
  }

  private isCacheFresh(): boolean {
    return this.cachedBrands !== undefined && this.cachedAt !== undefined && Date.now() - this.cachedAt < KNOWN_BRANDS_CACHE_TTL_MS
  }
}
