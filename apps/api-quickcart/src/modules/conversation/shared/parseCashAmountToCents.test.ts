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
import { parseCashAmountToCents } from './parseCashAmountToCents'

describe('parseCashAmountToCents', () => {
  const validCases: readonly [text: string, expectedCents: number][] = [
    ['150', 15000],
    ['150,00', 15000],
    ['R$ 150', 15000],
    ['R$150', 15000],
    ['150.00', 15000],
    ['1.500,00', 150000],
    ['1.500', 150000],
    ['  150  ', 15000],
  ]

  for (const [text, expectedCents] of validCases) {
    it(`aceita "${text}" como ${expectedCents} centavos`, () => {
      expect(parseCashAmountToCents(text)).toBe(expectedCents)
    })
  }

  const invalidCases: readonly string[] = ['', '   ', 'abc', '-150', '0', '0,00', 'cento e cinquenta']

  for (const text of invalidCases) {
    it(`recusa "${text}"`, () => {
      expect(parseCashAmountToCents(text)).toBeUndefined()
    })
  }
})
