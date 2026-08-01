/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A normalização é o que faz o relatório somar em vez de espalhar.
 *
 * "Açúcar", "acucar" e "AÇÚCAR" são o mesmo pedido; se cada grafia virar uma linha, o lojista lê três
 * pedidos de um em vez de um pedido de três — e subestima a demanda exatamente onde ela é maior, que é
 * o oposto do que o relatório existe para fazer.
 *
 * O agrupamento em si é SQL e está coberto pela verificação manual da rota; aqui trancamos a regra de
 * texto, que é onde o erro passa despercebido.
 */

import { describe, expect, it } from 'bun:test'
import { normalizeDemandTerm } from '@/modules/conversation/infra/database/DrizzleUnmatchedDemandRepository'

describe('normalizeDemandTerm', () => {
  it('agrupa grafias com e sem acento', () => {
    expect(normalizeDemandTerm('Açúcar')).toBe(normalizeDemandTerm('acucar'))
    expect(normalizeDemandTerm('AÇÚCAR')).toBe('acucar')
  })

  it('ignora espaço em volta', () => {
    expect(normalizeDemandTerm('  ovos  ')).toBe('ovos')
  })

  it('corta termo mais longo que o campo', () => {
    // Termo gigante é ruído de transcrição, não pedido — e estourar o varchar derrubaria a gravação.
    const enormous = 'a'.repeat(500)
    expect(normalizeDemandTerm(enormous).length).toBe(120)
  })

  it('devolve vazio para entrada sem conteúdo', () => {
    // Quem chama descarta o vazio: linha sem termo não é demanda, é lixo no relatório.
    expect(normalizeDemandTerm('   ')).toBe('')
  })
})
