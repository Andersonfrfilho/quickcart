/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O termo extraído é a chave de tudo o que vem depois: casamento com o catálogo, agrupamento no
 * relatório de demanda e o apelido que o lojista cadastra. Um "pacotes de" preso nele não erra um
 * pouco — erra em cadeia, e cada etapa esconde melhor a origem.
 *
 * Estes testes existem porque quem fala "dois pacotes" não escreve "2 pct": a regra de dígito estava
 * coberta pelo uso e a de número escrito não, e a diferença só apareceu num teste de ponta a ponta com
 * fala real.
 */

import { describe, expect, it } from 'bun:test'
import { ParseShoppingListUseCase } from '@/modules/conversation/application/use-cases/ParseShoppingList.use-case'

/**
 * Sem refinador de IA: o heurístico é o caminho que roda quando não há chave configurada, e é
 * justamente onde a extração de termo acontece.
 */
const parser = new ParseShoppingListUseCase({ refine: async () => undefined })

async function parse(rawText: string) {
  const result = await parser.execute({ rawText })
  return result.items
}

describe('ParseShoppingListUseCase — número escrito', () => {
  it('tira a unidade do termo quando o número vem escrito', async () => {
    const [item] = await parse('dois pacotes de modess')

    // Antes vinha `pacotes de modess`, que não casa com catálogo nem serve de apelido.
    expect(item?.term).toBe('modess')
    expect(item?.quantity).toBe(2)
    expect(item?.unit).toBe('pacotes')
  })

  it('trata litro como unidade, não como parte do nome', async () => {
    const [item] = await parse('um litro de leite')

    expect(item?.term).toBe('leite')
    expect(item?.quantity).toBe(1)
  })

  it('mantém o comportamento de dígito com unidade', async () => {
    const [item] = await parse('2 kg de arroz')

    expect(item?.term).toBe('arroz')
    expect(item?.quantity).toBe(2)
    expect(item?.unit).toBe('kg')
  })

  it('entende dúzia sem confundir com o nome do produto', async () => {
    const [item] = await parse('meia dúzia de ovos')

    expect(item?.term).toBe('ovos')
    expect(item?.quantity).toBe(6)
  })

  it('não come palavra do produto quando não há unidade', async () => {
    // "duas bananas" não tem unidade: "bananas" É o produto, e perdê-la deixaria o termo vazio.
    const [item] = await parse('duas bananas')

    expect(item?.term).toBe('bananas')
    expect(item?.quantity).toBe(2)
  })

  it('separa itens ditados com "e" e vírgula', async () => {
    const items = await parse('dois pacotes de modess, um litro de leite e seis ovos')

    expect(items.map((item) => item.term)).toEqual(['modess', 'leite', 'ovos'])
  })

  it('entende número por extenso além de três, que é como se fala', async () => {
    const items = await parse('seis ovos, oito bananas e doze cervejas')

    expect(items.map((item) => `${item.quantity}x ${item.term}`)).toEqual([
      '6x ovos',
      '8x bananas',
      '12x cervejas',
    ])
  })

  it('tira a pontuação que a transcrição deixa no fim', async () => {
    const items = await parse('dois quilos de arroz e um litro de leite.')

    expect(items.map((item) => item.term)).toEqual(['arroz', 'leite'])
  })
})
