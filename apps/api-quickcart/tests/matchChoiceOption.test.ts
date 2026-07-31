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
import { matchChoiceOption } from '@/modules/conversation/application/matchChoiceOption'

const MENU: ReadonlyArray<readonly [string, string]> = [
  ['quickcart_send_list', '📝 Enviar lista'],
  ['quickcart_browse', '🛒 Ver produtos'],
  ['quickcart_repeat', '🔁 Repetir pedido'],
]

describe('matchChoiceOption', () => {
  it('casa o rótulo exato, ignorando emoji e caixa', () => {
    expect(matchChoiceOption('Ver Produtos', MENU)).toBe('quickcart_browse')
    expect(matchChoiceOption('🛒 ver produtos', MENU)).toBe('quickcart_browse')
  })

  /**
   * O caso que motiva o arquivo: fala é sempre frase inteira. Sem casar, a resposta cai no `default`
   * do nó — que reenvia o menu — e o cliente que respondeu por voz ouve a mesma pergunta para sempre.
   */
  it('casa frase falada em volta do rótulo', () => {
    expect(matchChoiceOption('quero ver os produtos', MENU)).toBe('quickcart_browse')
    expect(matchChoiceOption('pode repetir o pedido da semana passada', MENU)).toBe('quickcart_repeat')
    expect(matchChoiceOption('vou enviar minha lista agora', MENU)).toBe('quickcart_send_list')
  })

  it('casa mesmo com acento diferente do rótulo', () => {
    expect(matchChoiceOption('quero ver prodútos', MENU)).toBe('quickcart_browse')
  })

  it('não casa quando o cliente diz outra coisa', () => {
    for (const fala of ['oi', 'bom dia', 'me manda o catálogo', 'quanto custa a entrega']) {
      expect(matchChoiceOption(fala, MENU)).toBeUndefined()
    }
  })

  /**
   * Adivinhar entre duas opções manda o cliente para o caminho errado, e ele só descobre três telas
   * depois. Reperguntar custa uma mensagem; pedido montado errado custa a compra.
   */
  it('devolve undefined no empate em vez de escolher', () => {
    const ambiguo: ReadonlyArray<readonly [string, string]> = [
      ['a', 'Pedido novo'],
      ['b', 'Pedido antigo'],
    ]

    expect(matchChoiceOption('quero ver meu pedido', ambiguo)).toBeUndefined()
  })

  // "ver" e "meu" aparecem em quase toda frase e casariam com opção que ninguém pediu.
  it('ignora palavras curtas demais para distinguir', () => {
    const curtas: ReadonlyArray<readonly [string, string]> = [['x', 'Ver']]

    expect(matchChoiceOption('quanto custa a entrega', curtas)).toBeUndefined()
  })

  it('aceita resposta vazia sem quebrar', () => {
    expect(matchChoiceOption('', MENU)).toBeUndefined()
    expect(matchChoiceOption('   ', MENU)).toBeUndefined()
  })
})
