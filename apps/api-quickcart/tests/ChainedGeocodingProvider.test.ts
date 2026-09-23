/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { describe, expect, it } from 'bun:test'
import { ChainedGeocodingProvider } from '@/infra/geocoding/ChainedGeocodingProvider'
import { GEOCODE_OUTCOME_KIND, type GeocodeOutcome, type GeocodingProviderInterface } from '@/modules/shared/address/GeocodingProvider.interface'
import { GEOCODE_PRECISION } from '@/modules/shared/address/Address.schema'

const FOUND: GeocodeOutcome = {
  kind: GEOCODE_OUTCOME_KIND.FOUND,
  coordinate: { latitude: -20.5, longitude: -47.4, precision: GEOCODE_PRECISION.CITY, provider: 'stub' },
}
const NOT_FOUND: GeocodeOutcome = { kind: GEOCODE_OUTCOME_KIND.NOT_FOUND }
const TRANSIENT_ERROR: GeocodeOutcome = { kind: GEOCODE_OUTCOME_KIND.TRANSIENT_ERROR }

function stubProvider(outcome: GeocodeOutcome, calls: string[], name: string): GeocodingProviderInterface {
  return {
    async geocodeByCep(_cep: string): Promise<GeocodeOutcome> {
      calls.push(name)
      return outcome
    },
  }
}

describe('ChainedGeocodingProvider', () => {
  it('primeiro FOUND ganha — o segundo provedor nem é chamado', async () => {
    const calls: string[] = []
    const chain = new ChainedGeocodingProvider([
      stubProvider(FOUND, calls, 'first'),
      stubProvider(FOUND, calls, 'second'),
    ])

    const outcome = await chain.geocodeByCep('14412-314')
    expect(outcome).toEqual(FOUND)
    expect(calls).toEqual(['first'])
  })

  it('not_found do primeiro cai para o segundo', async () => {
    const calls: string[] = []
    const chain = new ChainedGeocodingProvider([
      stubProvider(NOT_FOUND, calls, 'first'),
      stubProvider(FOUND, calls, 'second'),
    ])

    const outcome = await chain.geocodeByCep('14412-314')
    expect(outcome).toEqual(FOUND)
    expect(calls).toEqual(['first', 'second'])
  })

  it('transitório em um e not_found no outro é transient_error — não polui o cache negativo', async () => {
    const calls: string[] = []
    const chain = new ChainedGeocodingProvider([
      stubProvider(TRANSIENT_ERROR, calls, 'first'),
      stubProvider(NOT_FOUND, calls, 'second'),
    ])

    const outcome = await chain.geocodeByCep('14412-314')
    expect(outcome).toEqual(TRANSIENT_ERROR)
  })

  it('todos not_found é not_found', async () => {
    const calls: string[] = []
    const chain = new ChainedGeocodingProvider([
      stubProvider(NOT_FOUND, calls, 'first'),
      stubProvider(NOT_FOUND, calls, 'second'),
    ])

    const outcome = await chain.geocodeByCep('14412-314')
    expect(outcome).toEqual(NOT_FOUND)
  })
})
