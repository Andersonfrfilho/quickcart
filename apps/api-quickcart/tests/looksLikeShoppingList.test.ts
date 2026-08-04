/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O falso positivo é o erro caro aqui, e é por isso que metade destes testes são negativos.
 *
 * Aprovar demais faz o bot interromper o que a pessoa estava fazendo para montar um carrinho que ela
 * não pediu; reprovar demais só mantém o comportamento de hoje, que é pedir para ela tocar num item
 * de lista. Na dúvida o porteiro reprova.
 */

import { describe, expect, it } from 'bun:test'
import { looksLikeShoppingList } from '@/modules/conversation/application/looksLikeShoppingList'

describe('looksLikeShoppingList', () => {
  it('reconhece lista ditada com unidade de medida', () => {
    expect(looksLikeShoppingList('dois quilos de arroz, um litro de leite e seis ovos')).toBe(true)
    expect(looksLikeShoppingList('2kg de arroz e 1 pacote de café')).toBe(true)
    // Como a Groq costuma devolver: algarismo e unidade abreviada.
    expect(looksLikeShoppingList('2 kg de arroz, 1 litro de leite e 6 ovos.')).toBe(true)
  })

  it('reconhece quantidade com vários itens, mesmo sem unidade', () => {
    expect(looksLikeShoppingList('2 arroz, 1 leite, 6 ovos')).toBe(true)
  })

  it('reconhece enumeração longa sem número nenhum', () => {
    expect(looksLikeShoppingList('arroz, feijão, macarrão, café')).toBe(true)
  })

  it('não confunde pedido de navegação com lista', () => {
    // O caso que motivou tudo: isto tem de seguir para o menu, não para o interpretador de lista.
    expect(looksLikeShoppingList('quero ver os produtos')).toBe(false)
    expect(looksLikeShoppingList('ver categorias')).toBe(false)
    expect(looksLikeShoppingList('repetir meu pedido')).toBe(false)
  })

  it('não confunde apresentação com lista', () => {
    expect(looksLikeShoppingList('meu nome é ana paula')).toBe(false)
    expect(looksLikeShoppingList('oi, bom dia')).toBe(false)
  })

  it('reprova mensagem curta demais para ter forma', () => {
    expect(looksLikeShoppingList('oi')).toBe(false)
    expect(looksLikeShoppingList('sim')).toBe(false)
    expect(looksLikeShoppingList('ok')).toBe(false)
    expect(looksLikeShoppingList('')).toBe(false)
  })

  it('não confunde endereço de uma linha com lista', () => {
    // Endereço com vírgula ainda casa por contagem de itens — é por isso que o roteamento também
    // exclui os estados de checkout, e não confia só neste teste de forma.
    expect(looksLikeShoppingList('rua das flores 123 apto 45')).toBe(false)
  })

  it('exige fronteira de palavra nas unidades', () => {
    // "l" dentro de "leite" e "g" dentro de "água" não são unidade; sem fronteira, tudo seria lista.
    expect(looksLikeShoppingList('leite integral')).toBe(false)
    expect(looksLikeShoppingList('água com gás')).toBe(false)
  })

  it('ignora acento e caixa', () => {
    expect(looksLikeShoppingList('DOIS QUILOS DE AÇÚCAR')).toBe(true)
    expect(looksLikeShoppingList('três pacotes de pão')).toBe(true)
  })
})
