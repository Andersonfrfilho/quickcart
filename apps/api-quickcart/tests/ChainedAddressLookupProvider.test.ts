/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * `AddressLookupProviderInterface` não distingue "CEP não existe" de "provedor fora do ar" no
 * tipo — as duas são `undefined` (ver ViaCepAddressLookupProvider e AddressLookupProvider.interface).
 * Por isso não há aqui um teste "transitório vira not_found na cadeia" como em
 * ChainedGeocodingProvider.test.ts: o caso equivalente e testável é "um provedor falha e o próximo
 * ainda resolve" — é isso que impede uma queda do ViaCEP de virar 'não achei esse CEP' quando a
 * BrasilAPI está de pé.
 */

import { describe, expect, it } from 'bun:test'
import { ChainedAddressLookupProvider } from '@/infra/geocoding/ChainedAddressLookupProvider'
import type { AddressLookupProviderInterface, AddressLookupResult } from '@/modules/shared/address/AddressLookupProvider.interface'

const RESULT: AddressLookupResult = {
  street: 'Rua Radialista Alfeu Stabelini',
  neighborhood: 'Franca Pólo Club',
  city: 'Franca',
  state: 'SP',
}

function stubProvider(result: AddressLookupResult | undefined, calls: string[], name: string): AddressLookupProviderInterface {
  return {
    async lookupByCep(_cep: string): Promise<AddressLookupResult | undefined> {
      calls.push(name)
      return result
    },
  }
}

describe('ChainedAddressLookupProvider', () => {
  it('primeiro sucesso ganha — o segundo provedor nem é chamado', async () => {
    const calls: string[] = []
    const chain = new ChainedAddressLookupProvider([
      stubProvider(RESULT, calls, 'first'),
      stubProvider(RESULT, calls, 'second'),
    ])

    const result = await chain.lookupByCep('14412-314')
    expect(result).toEqual(RESULT)
    expect(calls).toEqual(['first'])
  })

  it('undefined do primeiro cai para o segundo — outage do primeiro não vira "CEP não existe"', async () => {
    const calls: string[] = []
    const chain = new ChainedAddressLookupProvider([
      stubProvider(undefined, calls, 'first'),
      stubProvider(RESULT, calls, 'second'),
    ])

    const result = await chain.lookupByCep('14412-314')
    expect(result).toEqual(RESULT)
    expect(calls).toEqual(['first', 'second'])
  })

  it('todos undefined é undefined', async () => {
    const calls: string[] = []
    const chain = new ChainedAddressLookupProvider([
      stubProvider(undefined, calls, 'first'),
      stubProvider(undefined, calls, 'second'),
    ])

    expect(await chain.lookupByCep('99999-999')).toBeUndefined()
    expect(calls).toEqual(['first', 'second'])
  })
})
