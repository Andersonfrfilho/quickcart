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

/**
 * Falando, as pessoas dizem o verbo: "quero 3 quilos de feijão". Escrevendo, mandam "3 kg de feijão".
 * A transcrição é fiel à fala, então a nota de voz trouxe esse formato para dentro do parser — e ele
 * perdia a quantidade, não só o termo.
 */
describe('ParseShoppingListUseCase — verbo de intenção na frente', () => {
  it('mantém quantidade e unidade quando o cliente diz "quero" antes', async () => {
    const [feijao, leite] = await parse('quero 3 quilos de feijão e 2 litros de leite')

    // Antes: term "quero 3 quilos de feijao" com quantidade 1 — pedido errado e demanda poluída.
    expect(feijao?.term).toBe('feijao')
    expect(feijao?.quantity).toBe(3)
    expect(feijao?.unit).toBe('quilos')
    expect(leite?.term).toBe('leite')
    expect(leite?.quantity).toBe(2)
  })

  it('entende "preciso de", "me manda" e "eu quero comprar"', async () => {
    const [ovos] = await parse('preciso de 6 ovos')
    expect(ovos?.term).toBe('ovos')
    expect(ovos?.quantity).toBe(6)

    const [tomate] = await parse('me manda 1 kg de tomate')
    expect(tomate?.term).toBe('tomate')
    expect(tomate?.unit).toBe('kg')

    const [acucar] = await parse('eu quero comprar 2 kg de açúcar')
    expect(acucar?.term).toBe('acucar')
    expect(acucar?.quantity).toBe(2)
  })

  it('não corta produto que começa parecido com o verbo', async () => {
    // "queijo" começa com as letras de "queria": exigir espaço depois do verbo é o que salva.
    const [queijo] = await parse('queijo e 2 litros de leite')
    expect(queijo?.term).toBe('queijo')
  })

  it('não cria item de um segmento que era só o verbo', async () => {
    const items = await parse('quero, 2 litros de leite')
    expect(items).toHaveLength(1)
    expect(items[0]?.term).toBe('leite')
  })
})
