/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Fixture real capturada em 2026-09-22 contra brasilapi.com.br/api/cep/v2 para Franca-SP: o mesmo
 * CEP que motivou o provider de geocodificação, agora usado para endereço porque o Railway não
 * alcança o ViaCEP a partir de staging.
 */

import { afterEach, describe, expect, it } from 'bun:test'
import { BrasilApiAddressLookupProvider } from '@/infra/brasilapi/BrasilApiAddressLookupProvider'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

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

describe('BrasilApiAddressLookupProvider', () => {
  it('mapeia street/neighborhood/city/state para o resultado', async () => {
    stubFetch(200, RESPOSTA_FRANCA)
    const result = await new BrasilApiAddressLookupProvider().lookupByCep('14412-314')

    expect(result).toEqual({
      street: 'Rua Radialista Alfeu Stabelini',
      neighborhood: 'Franca Pólo Club',
      city: 'Franca',
      state: 'SP',
    })
  })

  it('devolve undefined quando 404 — CEP não existe', async () => {
    stubFetch(404, { name: 'CepPromiseError' })
    expect(await new BrasilApiAddressLookupProvider().lookupByCep('99999-999')).toBeUndefined()
  })

  it('devolve undefined quando street vem ausente', async () => {
    stubFetch(200, { ...RESPOSTA_FRANCA, street: undefined })
    expect(await new BrasilApiAddressLookupProvider().lookupByCep('14412-314')).toBeUndefined()
  })

  it('devolve undefined quando o CEP não tem 8 dígitos, sem chamar o fetch', async () => {
    let called = false
    globalThis.fetch = (async () => {
      called = true
      return { ok: true, status: 200, json: async () => RESPOSTA_FRANCA }
    }) as unknown as typeof fetch

    expect(await new BrasilApiAddressLookupProvider().lookupByCep('123')).toBeUndefined()
    expect(called).toBe(false)
  })

  it('devolve undefined em 500, 429 e timeout — provedor fora do ar', async () => {
    stubFetch(500, {})
    expect(await new BrasilApiAddressLookupProvider().lookupByCep('14412-314')).toBeUndefined()

    stubFetch(429, {})
    expect(await new BrasilApiAddressLookupProvider().lookupByCep('14412-314')).toBeUndefined()

    globalThis.fetch = (async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError')
    }) as unknown as typeof fetch
    expect(await new BrasilApiAddressLookupProvider().lookupByCep('14412-314')).toBeUndefined()
  })

  it('devolve undefined em vez de lançar quando a rede falha', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    expect(await new BrasilApiAddressLookupProvider().lookupByCep('14412-314')).toBeUndefined()
  })

  it('devolve undefined quando o corpo é malformado (json inválido)', async () => {
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token')
      },
    })) as unknown as typeof fetch
    expect(await new BrasilApiAddressLookupProvider().lookupByCep('14412-314')).toBeUndefined()
  })
})
