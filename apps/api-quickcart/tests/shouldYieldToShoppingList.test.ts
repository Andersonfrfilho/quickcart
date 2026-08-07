/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Esta decisão determina se a fala do cliente vira carrinho ou vira nada. Já falhou de duas formas em
 * produção-como-dev: engolindo a lista de quem voltava depois de um dia, e engolindo a de quem chegava
 * pela primeira vez. Cada caso abaixo trava uma delas.
 */

import { describe, expect, it } from 'bun:test'
import { shouldYieldToShoppingList } from '@/modules/conversation/application/shouldYieldToShoppingList'

const LISTA = '3 quilos de feijão e 2 litros de leite'

function build(overrides: Partial<Parameters<typeof shouldYieldToShoppingList>[0]> = {}) {
  return {
    messageKind: 'text',
    body: LISTA,
    nodeType: 'action',
    nodeQuestionType: undefined,
    hasOptions: false,
    matchedOption: false,
    isAtStartNode: false,
    hasKnownCustomerName: true,
    ...overrides,
  }
}

describe('shouldYieldToShoppingList', () => {
  it('cede no menu quando nenhuma opção casou', () => {
    // O menu diz "pode me mandar sua lista", e quem obedecia recebia o menu de novo.
    expect(shouldYieldToShoppingList(build({ nodeType: 'menu', hasOptions: true }))).toBe(true)
  })

  it('não cede quando a mensagem casou com uma opção do menu', () => {
    expect(shouldYieldToShoppingList(build({ nodeType: 'menu', hasOptions: true, matchedOption: true }))).toBe(false)
  })

  it('cede no nó inicial quando o cliente já é conhecido', () => {
    // O caso do cliente que volta no dia seguinte e manda a lista de uma vez: o nó inicial é `action`
    // sem opções, então a regra antiga (só nó de escolha) descartava a lista em silêncio.
    expect(shouldYieldToShoppingList(build({ isAtStartNode: true }))).toBe(true)
  })

  it('NÃO cede no nó inicial quando o nome é desconhecido', () => {
    // Aqui quem manda é a coleta de nome. A lista não se perde: o FlowDriver a guarda no contexto e a
    // retoma depois do nome — ceder aqui pularia a pergunta e o pedido nasceria "Sem nome".
    expect(shouldYieldToShoppingList(build({ isAtStartNode: true, hasKnownCustomerName: false }))).toBe(false)
  })

  it('não cede em nó que pede um dado específico', () => {
    // "500, apto 12" tem forma de lista. A resposta pertence ao nó que perguntou.
    expect(
      shouldYieldToShoppingList(build({ nodeType: 'question', nodeQuestionType: 'text', body: '500, apto 12' })),
    ).toBe(false)
  })

  it('não cede o que não parece lista, nem mensagem que não é texto', () => {
    expect(shouldYieldToShoppingList(build({ isAtStartNode: true, body: 'oi' }))).toBe(false)
    expect(shouldYieldToShoppingList(build({ isAtStartNode: true, messageKind: 'button_reply' }))).toBe(false)
  })
})
