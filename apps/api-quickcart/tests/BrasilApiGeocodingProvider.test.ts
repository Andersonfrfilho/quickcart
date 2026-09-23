/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Fixture real capturada em 2026-09-22 contra brasilapi.com.br/api/cep/v2 para Franca-SP: o caso
 * que motivou este provider, porque o Nominatim não indexa CEP de Franca.
 */

import { afterEach, describe, expect, it } from 'bun:test'
import { GEOCODE_PRECISION } from '@/modules/shared/address/Address.schema'
import { BrasilApiGeocodingProvider } from '@/infra/brasilapi/BrasilApiGeocodingProvider'
import { GEOCODE_OUTCOME_KIND } from '@/modules/shared/address/GeocodingProvider.interface'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

/** `14412-314`, Franca-SP: coordenada é o centroide da cidade. */
const RESPOSTA_FRANCA = {
  cep: '14412314',
  state: 'SP',
  city: 'Franca',
  neighborhood: 'Franca Pólo Club',
  street: 'Rua Radialista Alfeu Stabelini',
  location: { type: 'Point', coordinates: { longitude: '-47.40083', latitude: '-20.53861' } },
}

function stubFetch(status: number, body: unknown): void {
  globalThis.fetch = (async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch
}

describe('BrasilApiGeocodingProvider', () => {
  it('devolve FOUND com latitude/longitude numéricas e precisão de cidade', async () => {
    stubFetch(200, RESPOSTA_FRANCA)
    const outcome = await new BrasilApiGeocodingProvider().geocodeByCep('14412-314')
    const result = outcome.kind === GEOCODE_OUTCOME_KIND.FOUND ? outcome.coordinate : undefined

    expect(result?.latitude).toBeCloseTo(-20.53861, 5)
    expect(result?.longitude).toBeCloseTo(-47.40083, 5)
    expect(result?.precision).toBe(GEOCODE_PRECISION.CITY)
    expect(result?.provider).toBe('brasilapi')
  })

  it('404 é not_found — o CEP não existe', async () => {
    stubFetch(404, { name: 'CepPromiseError' })
    const outcome = await new BrasilApiGeocodingProvider().geocodeByCep('99999-999')
    expect(outcome).toEqual({ kind: GEOCODE_OUTCOME_KIND.NOT_FOUND })
  })

  it('coordinates vazio ({}) é not_found — nunca inventa 0,0', async () => {
    stubFetch(200, { ...RESPOSTA_FRANCA, location: { type: 'Point', coordinates: {} } })
    const outcome = await new BrasilApiGeocodingProvider().geocodeByCep('14412-314')
    expect(outcome).toEqual({ kind: GEOCODE_OUTCOME_KIND.NOT_FOUND })
  })

  it('CEP curto é not_found sem chamar o fetch', async () => {
    let called = false
    globalThis.fetch = (async () => {
      called = true
      return { ok: true, status: 200, json: async () => RESPOSTA_FRANCA }
    }) as unknown as typeof fetch

    const outcome = await new BrasilApiGeocodingProvider().geocodeByCep('123')
    expect(outcome).toEqual({ kind: GEOCODE_OUTCOME_KIND.NOT_FOUND })
    expect(called).toBe(false)
  })

  /**
   * Corpo malformado (json() lança) cai no mesmo catch de erro de rede: não dá para distinguir
   * "servidor mandou lixo" de "conexão caiu no meio", e as duas merecem o mesmo tratamento —
   * transitório, para não poluir o cache negativo com um CEP que pode existir.
   */
  it('corpo malformado (json inválido) é transient_error, não not_found', async () => {
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token')
      },
    })) as unknown as typeof fetch

    const outcome = await new BrasilApiGeocodingProvider().geocodeByCep('14412-314')
    expect(outcome).toEqual({ kind: GEOCODE_OUTCOME_KIND.TRANSIENT_ERROR })
  })

  it('500 e 429 são transitórios; 400 é not_found', async () => {
    stubFetch(500, {})
    expect((await new BrasilApiGeocodingProvider().geocodeByCep('14412-314')).kind).toBe(
      GEOCODE_OUTCOME_KIND.TRANSIENT_ERROR,
    )

    stubFetch(429, {})
    expect((await new BrasilApiGeocodingProvider().geocodeByCep('14412-314')).kind).toBe(
      GEOCODE_OUTCOME_KIND.TRANSIENT_ERROR,
    )

    stubFetch(400, {})
    expect((await new BrasilApiGeocodingProvider().geocodeByCep('14412-314')).kind).toBe(
      GEOCODE_OUTCOME_KIND.NOT_FOUND,
    )
  })

  it('timeout (AbortSignal) é transient_error', async () => {
    globalThis.fetch = (async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError')
    }) as unknown as typeof fetch

    const outcome = await new BrasilApiGeocodingProvider().geocodeByCep('14412-314')
    expect(outcome).toEqual({ kind: GEOCODE_OUTCOME_KIND.TRANSIENT_ERROR })
  })

  it('erro de rede é transient_error', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch

    const outcome = await new BrasilApiGeocodingProvider().geocodeByCep('14412-314')
    expect(outcome).toEqual({ kind: GEOCODE_OUTCOME_KIND.TRANSIENT_ERROR })
  })
})
