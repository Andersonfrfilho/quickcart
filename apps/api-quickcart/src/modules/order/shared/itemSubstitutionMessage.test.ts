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
import type { ProductSearchResult } from '@/modules/catalog/domain/ProductRepository.interface'
import type { OrderDetail, OrderItemRecord } from '@/modules/order/domain/OrderRepository.interface'
import { buildItemSubstitutionMessage } from '@/modules/order/shared/itemSubstitutionMessage'

const detail = { order: { id: 'order-1', shortCode: 'QC-1006' } } as unknown as OrderDetail

const item = {
  id: 'item-1',
  productId: 'product-1',
  productName: 'Açúcar Refinado 2kg',
  quantity: 1,
  totalInCents: 900,
} as unknown as OrderItemRecord

function candidate(params: { readonly id: string; readonly brand: string; readonly priceInCents: number }): ProductSearchResult {
  return {
    id: params.id,
    name: 'Açúcar Refinado',
    brand: params.brand,
    unitSize: '2kg',
    priceInCents: params.priceInCents,
    score: 0.9,
  }
}

describe('buildItemSubstitutionMessage', () => {
  it('sem parecido não produz mensagem', () => {
    expect(buildItemSubstitutionMessage({ detail, item, candidates: [] })).toBeUndefined()
  })

  it('um parecido vira pergunta de botões', () => {
    const message = buildItemSubstitutionMessage({
      detail,
      item,
      candidates: [candidate({ id: 'product-2', brand: 'Tio João', priceInCents: 1180 })],
    })

    expect(message?.kind).toBe('buttons')
    expect(message?.body).toContain('Tio João Açúcar Refinado 2kg')
    expect(message?.body).toContain('Quer trocar?')
  })

  it('vários parecidos viram lista com todos no corpo e as duas saídas nas linhas', () => {
    const message = buildItemSubstitutionMessage({
      detail,
      item,
      candidates: [
        candidate({ id: 'product-2', brand: 'Tio João', priceInCents: 1180 }),
        candidate({ id: 'product-3', brand: 'União', priceInCents: 900 }),
        candidate({ id: 'product-4', brand: 'Caravelas', priceInCents: 850 }),
      ],
    })

    if (message?.kind !== 'list') throw new Error('esperava lista')

    expect(message.body).toContain('1. *Tio João Açúcar Refinado 2kg*')
    expect(message.body).toContain('2. *União Açúcar Refinado 2kg*')
    expect(message.body).toContain('3. *Caravelas Açúcar Refinado 2kg*')
    // Preço igual ao do item que faltou não gera texto de diferença.
    expect(message.body).not.toContain('(+R$ 0,00')

    expect(message.rows).toHaveLength(5)
    expect(message.rows.every((row) => row.title.length <= 24)).toBe(true)
    expect(message.rows[0]?.id).toContain('order-1:item-1:product-2')
    expect(message.rows.at(-2)?.title).toBe('➡️ Sem ele')
    expect(message.rows.at(-1)?.title).toBe('❌ Cancelar pedido')
  })
})
