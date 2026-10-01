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
import { buildAddressMapUrl } from './buildAddressMapUrl'

describe('buildAddressMapUrl', () => {
  it('endereço estruturado vira busca textual com rua, número, bairro e cidade', () => {
    const url = buildAddressMapUrl({
      cep: '14403-000',
      street: 'Rua Radialista Alfeu Stabelini',
      number: '6531',
      neighborhood: 'Franca Pólo Club',
      city: 'Franca',
      state: 'SP',
    })

    expect(url).toBe(
      'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent('Rua Radialista Alfeu Stabelini, 6531, Franca Pólo Club, Franca - SP, 14403-000'),
    )
  })

  it('complemento e referência ficam fora da busca: confundem o geocodificador', () => {
    const url = buildAddressMapUrl({
      cep: '14403-000',
      street: 'Rua Radialista Alfeu Stabelini',
      number: '6531',
      complement: 'apto 42',
      reference: 'portão azul ao lado da padaria',
      neighborhood: 'Franca Pólo Club',
      city: 'Franca',
      state: 'SP',
    })

    expect(url).not.toContain('apto')
    expect(url).not.toContain('port')
  })

  it('localização enviada pelo cliente usa a coordenada, que é o ponto exato', () => {
    const url = buildAddressMapUrl({ latitude: -20.5386, longitude: -47.4008, number: '6531' })

    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=-20.5386,-47.4008')
  })

  it('endereço legado em texto livre não tem link: a busca cairia em qualquer lugar', () => {
    expect(buildAddressMapUrl('rua de casa, perto do mercado')).toBeUndefined()
    expect(buildAddressMapUrl(undefined)).toBeUndefined()
  })
})
