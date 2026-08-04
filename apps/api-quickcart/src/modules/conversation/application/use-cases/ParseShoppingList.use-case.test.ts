/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Casca a cascata de regex da spec §3.1 sem Groq (NullListRefinerProvider) —
 * cobre os formatos de quantidade/unidade suportados e a segmentação de listas.
 */

import { describe, expect, test } from 'bun:test'
import { NullListRefinerProvider } from '@/modules/conversation/infra/providers/NullListRefinerProvider'
import type { ParsedListItem } from '@/modules/conversation/application/types/ParseShoppingList.types'
import { ParseShoppingListUseCase } from './ParseShoppingList.use-case'

function buildUseCase(): ParseShoppingListUseCase {
  return new ParseShoppingListUseCase(new NullListRefinerProvider())
}

describe('ParseShoppingListUseCase', () => {
  const cases: readonly [description: string, rawText: string, expected: ParsedListItem[]][] = [
    ['peso à esquerda em kg', '2kg de arroz', [{ term: 'arroz', quantity: 2, unit: 'kg' }]],
    ['peso à esquerda com espaço', '2 kg de feijao', [{ term: 'feijao', quantity: 2, unit: 'kg' }]],
    ['peso à direita', 'arroz 2kg', [{ term: 'arroz', quantity: 2, unit: 'kg' }]],
    ['contagem com x', '3x leite', [{ term: 'leite', quantity: 3, unit: 'x' }]],
    ['numeral por extenso: meia dúzia', 'meia duzia de ovos', [{ term: 'ovos', quantity: 6, unit: 'un' }]],
    ['numeral por extenso: uma dúzia', 'uma duzia de ovos', [{ term: 'ovos', quantity: 12, unit: 'un' }]],
    // Antes esperava `pacotes de macarrao` com unidade `un`. Era limitação lida como regra: a mesma
    // tabela já tirava a unidade em "2 kg de arroz", e o termo com "pacotes de" preso não casa com o
    // catálogo, entope o relatório de demanda com uma linha por embalagem e não serve de apelido.
    ['numeral por extenso: dois (unidade sai do termo)', 'dois pacotes de macarrao', [{ term: 'macarrao', quantity: 2, unit: 'pacotes' }]],
    ['numeral por extenso: uma', 'uma cebola', [{ term: 'cebola', quantity: 1, unit: 'un' }]],
    ['sem quantidade, fallback 1/un', 'sabao em po', [{ term: 'sabao em po', quantity: 1, unit: 'un' }]],
    ['unidade em litros por extenso', '2 litros de leite', [{ term: 'leite', quantity: 2, unit: 'litros' }]],
    ['unidade em gramas por extenso', '500 gramas de queijo', [{ term: 'queijo', quantity: 500, unit: 'gramas' }]],
    ['quantidade decimal com vírgula não é confundida com separador de lista', '1,5kg de carne', [{ term: 'carne', quantity: 1.5, unit: 'kg' }]],
    [
      'lista separada por vírgulas',
      '2kg arroz, leite, 6 ovos',
      [
        { term: 'arroz', quantity: 2, unit: 'kg' },
        { term: 'leite', quantity: 1, unit: 'un' },
        { term: 'ovos', quantity: 6, unit: 'un' },
      ],
    ],
    ['número solto sem palavra de unidade', '6 ovos', [{ term: 'ovos', quantity: 6, unit: 'un' }]],
    ['número solto com termo composto', '3 bananas prata', [{ term: 'bananas prata', quantity: 3, unit: 'un' }]],
    [
      'lista separada por linhas',
      'arroz\nfeijao\nleite',
      [
        { term: 'arroz', quantity: 1, unit: 'un' },
        { term: 'feijao', quantity: 1, unit: 'un' },
        { term: 'leite', quantity: 1, unit: 'un' },
      ],
    ],
    [
      'lista com bullets e numeração',
      '- arroz\n* feijao\n1) leite\n2. acucar',
      [
        { term: 'arroz', quantity: 1, unit: 'un' },
        { term: 'feijao', quantity: 1, unit: 'un' },
        { term: 'leite', quantity: 1, unit: 'un' },
        { term: 'acucar', quantity: 1, unit: 'un' },
      ],
    ],
    [
      'separador por "e"',
      'arroz e feijao',
      [
        { term: 'arroz', quantity: 1, unit: 'un' },
        { term: 'feijao', quantity: 1, unit: 'un' },
      ],
    ],
    ['remove acentuação e caixa alta', 'AÇÚCAR', [{ term: 'acucar', quantity: 1, unit: 'un' }]],
    ['unidade "un" à direita', 'ovos 6un', [{ term: 'ovos', quantity: 6, unit: 'un' }]],
    ['contagem com palavra "unidades"', '4 unidades de iogurte', [{ term: 'iogurte', quantity: 4, unit: 'unidades' }]],
  ]

  for (const [description, rawText, expected] of cases) {
    test(description, async () => {
      const result = await buildUseCase().execute({ rawText })
      expect(result.items).toEqual(expected)
      expect(result.refinedByGroq).toBe(false)
    })
  }

  test('texto vazio não gera itens', async () => {
    const result = await buildUseCase().execute({ rawText: '   ' })
    expect(result.items).toEqual([])
    expect(result.refinedByGroq).toBe(false)
  })
})
