/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { describe, expect, test } from 'bun:test'
import { resolvePackQuantity } from '@/modules/conversation/application/resolvePackQuantity'

describe('resolvePackQuantity', () => {
  test('5kg pedidos com pacote de 5kg → 1 unidade', () => {
    expect(resolvePackQuantity({ requestedQuantity: 5, requestedUnit: 'kg', unitSize: '5kg' })).toEqual({ quantity: 1 })
  })

  test('5kg pedidos só com pacote de 1kg → 5 unidades', () => {
    expect(resolvePackQuantity({ requestedQuantity: 5, requestedUnit: 'kg', unitSize: '1kg' })).toEqual({ quantity: 5 })
  })

  test('4kg pedidos com pacotes de 2kg → 2 unidades (maior pacote que divide exato)', () => {
    expect(resolvePackQuantity({ requestedQuantity: 4, requestedUnit: 'kg', unitSize: '2kg' })).toEqual({ quantity: 2 })
  })

  test('500g pedidos com pacote de 500g → 1 unidade', () => {
    expect(resolvePackQuantity({ requestedQuantity: 500, requestedUnit: 'g', unitSize: '500g' })).toEqual({ quantity: 1 })
  })

  test('1,5kg pedidos com pacote de 1,5kg → 1 unidade', () => {
    expect(resolvePackQuantity({ requestedQuantity: 1.5, requestedUnit: 'kg', unitSize: '1,5kg' })).toEqual({ quantity: 1 })
  })

  test('litros contra mililitros: 2L pedidos com pacote de 900ml não divide exato → indefinido', () => {
    expect(resolvePackQuantity({ requestedQuantity: 2, requestedUnit: 'l', unitSize: '900ml' })).toBeUndefined()
  })

  test('litros contra mililitros compatíveis: 1,8L com pacote de 900ml → 2 unidades', () => {
    expect(resolvePackQuantity({ requestedQuantity: 1.8, requestedUnit: 'l', unitSize: '900ml' })).toEqual({ quantity: 2 })
  })

  test('kg nunca casa com unitSize em ml (dimensão diferente)', () => {
    expect(resolvePackQuantity({ requestedQuantity: 1, requestedUnit: 'kg', unitSize: '1000ml' })).toBeUndefined()
  })

  test('unidade falada ("quilos") é reconhecida como peso', () => {
    expect(resolvePackQuantity({ requestedQuantity: 5, requestedUnit: 'quilos', unitSize: '5kg' })).toEqual({ quantity: 1 })
  })

  test('unidade de contagem ("un") não é afetada pela regra', () => {
    expect(resolvePackQuantity({ requestedQuantity: 3, requestedUnit: 'un', unitSize: '5kg' })).toBeUndefined()
  })

  test('unidade de contagem ("pacotes") não é afetada pela regra', () => {
    expect(resolvePackQuantity({ requestedQuantity: 3, requestedUnit: 'pacotes', unitSize: '500g' })).toBeUndefined()
  })

  test('produto sem unitSize cai no comportamento de hoje', () => {
    expect(resolvePackQuantity({ requestedQuantity: 5, requestedUnit: 'kg', unitSize: null })).toBeUndefined()
  })

  test('total pedido não múltiplo do pacote cai no comportamento de hoje', () => {
    expect(resolvePackQuantity({ requestedQuantity: 3, requestedUnit: 'kg', unitSize: '2kg' })).toBeUndefined()
  })
})
