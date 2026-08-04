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
import { judgeCustomerName } from '@/modules/conversation/application/customerNameGuard'

describe('judgeCustomerName', () => {
  it('aceita um nome simples', () => {
    expect(judgeCustomerName('João')).toEqual({ kind: 'accepted', name: 'João' })
  })

  /**
   * O que mais importa aqui. Filtro por substring rejeita "Paulo" por conter `pau`, "Ana Cunha" e
   * "Marcus" por conterem `cu` — e Paulo, Paula e Cunha estão entre os nomes mais comuns do Brasil.
   * Barrar cliente legítimo em silêncio é pior do que aceitar um apelido ruim.
   */
  it('não confunde nome comum com xingamento', () => {
    for (const nome of ['Paulo', 'Paula', 'Ana Cunha', 'Marcus', 'Rolando', 'Marcos Pinto']) {
      expect(judgeCustomerName(nome).kind).toBe('accepted')
    }
  })

  it('recusa xingamento', () => {
    expect(judgeCustomerName('babaca')).toEqual({ kind: 'rejected', reason: 'offensive' })
  })

  it('recusa xingamento escondido numa frase', () => {
    expect(judgeCustomerName('meu nome é babaca')).toEqual({ kind: 'rejected', reason: 'offensive' })
  })

  it('recusa resposta curta demais', () => {
    for (const resposta of ['', ' ', 'a', '.', undefined]) {
      expect(judgeCustomerName(resposta).kind).toBe('rejected')
    }
  })

  /**
   * Ninguém responde só "João". E depois que áudio entrou no fluxo isso deixou de ser cortesia:
   * transcrição de fala é sempre frase inteira, nunca uma palavra.
   */
  it('extrai o nome de resposta em linguagem natural', () => {
    const casos: ReadonlyArray<readonly [string, string]> = [
      ['meu nome é João', 'João'],
      ['me chamo Maria', 'Maria'],
      ['sou o Pedro', 'Pedro'],
      ['eu sou a Ana', 'Ana'],
      ['oi, meu nome é Carlos', 'Carlos'],
      ['bom dia, me chamo Lucia', 'Lucia'],
      ['aqui é o Rafael', 'Rafael'],
    ]

    for (const [resposta, esperado] of casos) {
      expect(judgeCustomerName(resposta)).toEqual({ kind: 'accepted', name: esperado })
    }
  })

  // Transcrição de áudio vem com pontuação de fim de frase e em caixa baixa.
  it('limpa pontuação e capitaliza, como vem do áudio transcrito', () => {
    expect(judgeCustomerName('sou o joão pedro.')).toEqual({ kind: 'accepted', name: 'João Pedro' })
    expect(judgeCustomerName('meu nome é maria!')).toEqual({ kind: 'accepted', name: 'Maria' })
  })

  it('corta em 120 caracteres, o limite da coluna', () => {
    const verdict = judgeCustomerName('a'.repeat(200))

    expect(verdict.kind).toBe('accepted')
    if (verdict.kind === 'accepted') expect(verdict.name.length).toBeLessThanOrEqual(120)
  })
})
