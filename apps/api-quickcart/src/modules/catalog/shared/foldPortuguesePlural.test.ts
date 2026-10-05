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
import { foldPortuguesePlural } from './foldPortuguesePlural'

describe('foldPortuguesePlural', () => {
  it.each([
    ['paes', 'pao'],
    ['pães', 'pao'],
    ['feijões', 'feijao'],
    ['limoes', 'limao'],
    ['sabões', 'sabao'],
    ['grãos', 'grao'],
    ['cães', 'cao'],
  ])('família -ão: "%s" vira "%s"', (term, expected) => {
    expect(foldPortuguesePlural(term)).toBe(expected)
  })

  it.each([
    ['papéis', 'papel'],
    ['papeis', 'papel'],
    ['pastéis', 'pastel'],
    ['cereais', 'cereal'],
    ['jornais', 'jornal'],
  ])('família -el/-al: "%s" vira "%s"', (term, expected) => {
    expect(foldPortuguesePlural(term)).toBe(expected)
  })

  it('dobra só a palavra que é plural, no meio de um termo maior', () => {
    expect(foldPortuguesePlural('pães de queijo')).toBe('pao de queijo')
    expect(foldPortuguesePlural('2 pães franceses')).toBe('2 pao franceses')
    expect(foldPortuguesePlural('papeis higienicos')).toBe('papel higienicos')
  })

  /*
   * O contrato que protege a busca comum: sem plural irregular não há variante, e a consulta custa o
   * mesmo de antes. Devolver o termo sem acento aqui dobraria o custo de TODA busca.
   */
  it.each(['pão', 'arroz', 'ovos', 'tomates', 'refrigerantes', 'Pão Francês', 'leite integral'])(
    'não devolve variante para "%s"',
    (term) => {
      expect(foldPortuguesePlural(term)).toBeUndefined()
    },
  )

  /*
   * Palavras comuns que TERMINAM como um plural irregular mas não são: dobrá-las criaria uma
   * variante falsa. "seis ovos" e "dois pães" são pedidos que existem.
   */
  it.each(['seis', 'seis ovos', 'mais', 'pais', 'reis', 'caos', 'oes', 'dois'])(
    'não confunde "%s" com plural',
    (term) => {
      expect(foldPortuguesePlural(term)).toBeUndefined()
    },
  )

  it('"seis ovos" nao e tocado, mas "dois paes" dobra so o plural', () => {
    expect(foldPortuguesePlural('seis ovos')).toBeUndefined()
    expect(foldPortuguesePlural('dois paes')).toBe('dois pao')
  })
})
