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
import { createBarcodeProductIdentifier } from '@/modules/catalog/infra/vision/identifyProductByBarcode'

const IMAGE = { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' }

type Product = { id: string; name: string; brand?: string | null; unitSize?: string | null }

function build(options: { barcode?: string; product?: Product }) {
  const consulted: string[] = []

  const identify = createBarcodeProductIdentifier({
    engine: { read: async () => (options.barcode ? { barcode: options.barcode } : {}) },
    productRepository: {
      findByBarcode: async (barcode: string) => {
        consulted.push(barcode)
        return options.product as never
      },
    },
  })

  return { identify, consulted }
}

describe('foto com código de barras', () => {
  it('vira o termo que o cliente teria digitado', async () => {
    const { identify } = build({
      barcode: '7891000100103',
      product: { id: 'p1', name: 'Leite Integral', brand: 'Itambé', unitSize: '1L' },
    })

    expect(await identify(IMAGE)).toEqual({ outcome: 'identified', productName: 'Itambé Leite Integral 1L' })
  })

  it('inclui o tamanho, que é o que separa irmãos de mesmo nome', async () => {
    // "Leite Itambé 1L" e "Leite Itambé 2L" têm códigos distintos e nomes iguais: sem o tamanho, a
    // busca voltaria aos dois e perguntaria o que a foto já respondeu.
    const { identify } = build({
      barcode: '789',
      product: { id: 'p2', name: 'Leite Integral', brand: 'Itambé', unitSize: '2L' },
    })

    const result = await identify(IMAGE)

    expect(result).toEqual({ outcome: 'identified', productName: 'Itambé Leite Integral 2L' })
  })

  it('produto sem marca nem tamanho volta só com o nome, sem espaço sobrando', async () => {
    const { identify } = build({ barcode: '789', product: { id: 'p3', name: 'Banana Prata' } })

    expect(await identify(IMAGE)).toEqual({ outcome: 'identified', productName: 'Banana Prata' })
  })
})

describe('quando não dá para identificar', () => {
  it('foto sem código legível não consulta o catálogo', async () => {
    // Embalagem fotografada de lado é o caso comum, não falha: e uma consulta a menos por foto.
    const { identify, consulted } = build({})

    expect(await identify(IMAGE)).toEqual({ outcome: 'unmatched' })
    expect(consulted).toEqual([])
  })

  it('código lido sem produto cadastrado é unmatched, não erro', async () => {
    const { identify, consulted } = build({ barcode: '7891000100103' })

    expect(await identify(IMAGE)).toEqual({ outcome: 'unmatched' })
    expect(consulted).toEqual(['7891000100103'])
  })
})
