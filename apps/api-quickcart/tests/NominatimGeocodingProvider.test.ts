/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * As respostas abaixo são recortes REAIS da API, capturadas em 2026-08-02 contra
 * nominatim.openstreetmap.org. Importa porque a classificação de precisão decide se a loja promete
 * horário ao cliente, e ela não sai de nenhum campo óbvio: `type` é `postcode` para todos os CEPs, e
 * `place_rank` é 21 para todos. O que distingue são as chaves de `address`.
 */

import { afterEach, describe, expect, it } from 'bun:test'
import { GEOCODE_PRECISION } from '@/modules/shared/address/Address.schema'
import { NominatimGeocodingProvider } from '@/infra/nominatim/NominatimGeocodingProvider'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

type FetchCall = { readonly url: string; readonly headers: Record<string, string> }

function stubFetch(body: unknown, calls: FetchCall[] = []): void {
  globalThis.fetch = (async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url: String(url), headers: init?.headers ?? {} })
    return { ok: true, json: async () => body }
  }) as unknown as typeof fetch
}

/** `01310-100`, Bela Vista: tem `suburb` — coordenada de bairro. */
const RESPOSTA_BAIRRO = [
  {
    lat: '-23.5649659',
    lon: '-46.6518144',
    type: 'postcode',
    place_rank: 21,
    address: { postcode: '01310-100', suburb: 'Bela Vista', city: 'São Paulo', state: 'São Paulo' },
  },
]

/** `01415-000`, Consolação: tem `city_district` em vez de `suburb` — mesma precisão, chave diferente. */
const RESPOSTA_DISTRITO = [
  {
    lat: '-23.5524469',
    lon: '-46.6558521',
    type: 'postcode',
    place_rank: 21,
    address: { postcode: '01415-000', city_district: 'Consolação', city: 'São Paulo' },
  },
]

/** `37925-000`, Piumhi: só `municipality` — o município inteiro, pode errar quilômetros. */
const RESPOSTA_MUNICIPIO = [
  {
    lat: '-20.4742903',
    lon: '-45.9683809',
    type: 'postcode',
    place_rank: 21,
    address: { postcode: '37925-000', municipality: 'Piumhi', state: 'Minas Gerais' },
  },
]

describe('NominatimGeocodingProvider', () => {
  it('classifica CEP com bairro como precisão de CEP', async () => {
    stubFetch(RESPOSTA_BAIRRO)
    const result = await new NominatimGeocodingProvider().geocodeByCep('01310-100')

    expect(result?.latitude).toBeCloseTo(-23.5649659, 6)
    expect(result?.longitude).toBeCloseTo(-46.6518144, 6)
    expect(result?.precision).toBe(GEOCODE_PRECISION.POSTAL_CODE)
    expect(result?.provider).toBe('nominatim')
  })

  it('trata city_district como equivalente a suburb', async () => {
    stubFetch(RESPOSTA_DISTRITO)
    const result = await new NominatimGeocodingProvider().geocodeByCep('01415-000')
    expect(result?.precision).toBe(GEOCODE_PRECISION.POSTAL_CODE)
  })

  it('classifica CEP genérico como cidade — é o que suprime a previsão de horário', async () => {
    stubFetch(RESPOSTA_MUNICIPIO)
    const result = await new NominatimGeocodingProvider().geocodeByCep('37925-000')
    expect(result?.precision).toBe(GEOCODE_PRECISION.CITY)
  })

  it('manda User-Agent identificando a aplicação — exigência da política de uso', async () => {
    const calls: FetchCall[] = []
    stubFetch(RESPOSTA_BAIRRO, calls)
    await new NominatimGeocodingProvider().geocodeByCep('01310-100')

    expect(calls[0]?.headers['User-Agent']).toContain('quickcart')
    expect(calls[0]?.url).toContain('postalcode=01310-100')
    expect(calls[0]?.url).toContain('country=Brazil')
  })

  it('normaliza o CEP para o formato com hífen na consulta', async () => {
    const calls: FetchCall[] = []
    stubFetch(RESPOSTA_BAIRRO, calls)
    await new NominatimGeocodingProvider().geocodeByCep('01310100')
    expect(calls[0]?.url).toContain('postalcode=01310-100')
  })

  it('devolve undefined para lista vazia, coordenada não numérica e CEP curto', async () => {
    const provider = new NominatimGeocodingProvider()

    stubFetch([])
    expect(await provider.geocodeByCep('99999-999')).toBeUndefined()

    stubFetch([{ lat: 'não-é-número', lon: '-46.6', address: { suburb: 'X' } }])
    expect(await provider.geocodeByCep('01310-100')).toBeUndefined()

    expect(await provider.geocodeByCep('123')).toBeUndefined()
  })

  it('devolve undefined em vez de lançar quando a rede falha', async () => {
    globalThis.fetch = (async () => {
      throw new Error('network down')
    }) as typeof fetch

    expect(await new NominatimGeocodingProvider().geocodeByCep('01310-100')).toBeUndefined()
  })
})
