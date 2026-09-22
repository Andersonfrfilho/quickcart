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
import { isHumanHandoffRequest } from './isHumanHandoffRequest'

describe('isHumanHandoffRequest', () => {
  const positiveCases: readonly string[] = [
    'atendente',
    'Quero falar com um atendente!',
    'falar com alguém',
    'ATENDENTE?',
    'humano',
    'preciso falar com uma pessoa',
  ]

  for (const text of positiveCases) {
    it(`reconhece "${text}" como pedido de atendente`, () => {
      expect(isHumanHandoffRequest(text)).toBe(true)
    })
  }

  const negativeCases: readonly string[] = [
    'o atendente de ontem errou meu pedido',
    'humanos erram',
    'pessoa física',
    '2 atendente',
  ]

  for (const text of negativeCases) {
    it(`NÃO dispara para "${text}" (não é a frase inteira)`, () => {
      expect(isHumanHandoffRequest(text)).toBe(false)
    })
  }
})
