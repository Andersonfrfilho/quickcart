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
import type { KnownBrandsProvider } from '@/modules/conversation/application/providers/KnownBrandsProvider.interface'
import type { ParsedListItem } from '@/modules/conversation/application/types/ParseShoppingList.types'
import { normalizeBrand } from '@/modules/conversation/shared/normalizeBrand'
import { ParseShoppingListUseCase } from './ParseShoppingList.use-case'

class FakeKnownBrandsProvider implements KnownBrandsProvider {
  constructor(private readonly brands: readonly string[] = []) {}

  async listKnownBrands(): Promise<ReadonlySet<string>> {
    return new Set(this.brands.map(normalizeBrand))
  }
}

class FailingKnownBrandsProvider implements KnownBrandsProvider {
  async listKnownBrands(): Promise<ReadonlySet<string>> {
    throw new Error('catálogo indisponível')
  }
}

function buildUseCase(brands: readonly string[] = []): ParseShoppingListUseCase {
  return new ParseShoppingListUseCase(new NullListRefinerProvider(), new FakeKnownBrandsProvider(brands))
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

  describe('marca e quantidade órfãs (transcrição do Whisper separa por vírgula)', () => {
    test('caso real: marca de catálogo entra no termo, e a quantidade órfã vira do item anterior', async () => {
      const result = await buildUseCase(['Broto Legal']).execute({
        rawText: 'Quero arroz, broto legal, 2kg, açúcar e sal.',
      })

      expect(result.items).toEqual([
        { term: 'arroz broto legal', quantity: 2, unit: 'kg' },
        { term: 'acucar', quantity: 1, unit: 'un' },
        { term: 'sal', quantity: 1, unit: 'un' },
      ])
    })

    test('caso real: quantidade escrita depois da lista vira a quantidade do último item', async () => {
      const result = await buildUseCase().execute({ rawText: 'Eu quero arroz e açúcar, 5 quilos.' })

      expect(result.items).toEqual([
        { term: 'arroz', quantity: 1, unit: 'un' },
        { term: 'acucar', quantity: 5, unit: 'quilos' },
      ])
    })

    test('quantidade órfã no início da lista é descartada, sem item anterior para receber', async () => {
      const result = await buildUseCase().execute({ rawText: '2kg, arroz' })

      expect(result.items).toEqual([{ term: 'arroz', quantity: 1, unit: 'un' }])
    })

    test('marca sozinha, sem item anterior, vira o próprio termo', async () => {
      const result = await buildUseCase(['Broto Legal']).execute({ rawText: 'broto legal' })

      expect(result.items).toEqual([{ term: 'broto legal', quantity: 1, unit: 'un' }])
    })

    test('item anterior com quantidade explícita descarta a quantidade órfã seguinte', async () => {
      const result = await buildUseCase().execute({ rawText: '2kg arroz, 3kg' })

      expect(result.items).toEqual([{ term: 'arroz', quantity: 2, unit: 'kg' }])
    })

    test('casamento de marca ignora acentuação e caixa', async () => {
      const result = await buildUseCase(['Broto Legal']).execute({ rawText: 'arroz, BRÓTO LÉGAL' })

      expect(result.items).toEqual([{ term: 'arroz broto legal', quantity: 1, unit: 'un' }])
    })

    test('quando o provedor de marcas falha, a lista é montada sem o merge de marca', async () => {
      const useCase = new ParseShoppingListUseCase(new NullListRefinerProvider(), new FailingKnownBrandsProvider())

      const result = await useCase.execute({ rawText: 'arroz, broto legal' })

      expect(result.items).toEqual([
        { term: 'arroz', quantity: 1, unit: 'un' },
        { term: 'broto legal', quantity: 1, unit: 'un' },
      ])
    })
  })

  describe('item sem vírgula depois do peso', () => {
    test('corta a transcrição real do staging em quatro itens', async () => {
      const result = await buildUseCase(['Broto Legal']).execute({ rawText: 'Quero arroz broto legal de 5kg Feijão e açúcar E sal' })

      expect(result.items).toEqual([
        { term: 'arroz broto legal', quantity: 5, unit: 'kg' },
        { term: 'feijao', quantity: 1, unit: 'un' },
        { term: 'acucar', quantity: 1, unit: 'un' },
        { term: 'sal', quantity: 1, unit: 'un' },
      ])
    })

    test('separa itens com o peso depois do produto', async () => {
      const result = await buildUseCase().execute({ rawText: 'feijao 1kg arroz 5kg' })

      expect(result.items).toEqual([
        { term: 'feijao', quantity: 1, unit: 'kg' },
        { term: 'arroz', quantity: 5, unit: 'kg' },
      ])
    })

    test('não corta quando o peso vem antes do produto', async () => {
      const result = await buildUseCase().execute({ rawText: '5 kg de feijão e 5kg arroz' })

      expect(result.items).toEqual([
        { term: 'feijao', quantity: 5, unit: 'kg' },
        { term: 'arroz', quantity: 5, unit: 'kg' },
      ])
    })
  })

  describe('pontuação e conjunção da fala', () => {
    test('separa itens no ponto final e entende o verbo depois de "também"', async () => {
      const result = await buildUseCase(['Tio João']).execute({
        rawText: 'Quero comprar 5 kg de arroz, tio João, e açúcar, feijão de 2 kg. Também quero sal.',
      })

      expect(result.items).toEqual([
        { term: 'arroz tio joao', quantity: 5, unit: 'kg' },
        { term: 'acucar', quantity: 1, unit: 'un' },
        { term: 'feijao', quantity: 2, unit: 'kg' },
        { term: 'sal', quantity: 1, unit: 'un' },
      ])
    })

    test('não deixa a conjunção no começo do termo', async () => {
      const result = await buildUseCase().execute({ rawText: 'arroz, e açúcar' })

      expect(result.items).toEqual([
        { term: 'arroz', quantity: 1, unit: 'un' },
        { term: 'acucar', quantity: 1, unit: 'un' },
      ])
    })

    test('preserva o decimal ditado com ponto ou vírgula', async () => {
      const result = await buildUseCase().execute({ rawText: '1,5kg de arroz e 2.5 litros de leite' })

      expect(result.items).toEqual([
        { term: 'arroz', quantity: 1.5, unit: 'kg' },
        { term: 'leite', quantity: 2.5, unit: 'litros' },
      ])
    })
  })
})
