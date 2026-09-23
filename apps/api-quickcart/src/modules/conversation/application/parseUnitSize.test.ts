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
import { UNIT_DIMENSION, parseUnitSize } from '@/modules/conversation/application/parseUnitSize'

describe('parseUnitSize', () => {
  test('kg vira gramas', () => {
    expect(parseUnitSize('5kg')).toEqual({ amount: 5000, dimension: UNIT_DIMENSION.MASS })
  })

  test('decimal com vírgula', () => {
    expect(parseUnitSize('1,5kg')).toEqual({ amount: 1500, dimension: UNIT_DIMENSION.MASS })
  })

  test('gramas fica em gramas', () => {
    expect(parseUnitSize('500g')).toEqual({ amount: 500, dimension: UNIT_DIMENSION.MASS })
  })

  test('litro vira mililitros', () => {
    expect(parseUnitSize('1L')).toEqual({ amount: 1000, dimension: UNIT_DIMENSION.VOLUME })
  })

  test('mililitros fica em mililitros', () => {
    expect(parseUnitSize('900ml')).toEqual({ amount: 900, dimension: UNIT_DIMENSION.VOLUME })
  })

  test('tolera espaço e caixa alta', () => {
    expect(parseUnitSize(' 2 KG ')).toEqual({ amount: 2000, dimension: UNIT_DIMENSION.MASS })
  })

  test('kit "5x200g" não é parseável', () => {
    expect(parseUnitSize('5x200g')).toBeUndefined()
  })

  test('unidade de contagem ("12 rolos") não é parseável', () => {
    expect(parseUnitSize('12 rolos')).toBeUndefined()
  })

  test('nulo e ausente não são parseáveis', () => {
    expect(parseUnitSize(null)).toBeUndefined()
    expect(parseUnitSize(undefined)).toBeUndefined()
  })
})
