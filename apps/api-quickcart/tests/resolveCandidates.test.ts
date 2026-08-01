/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A linha "tanto faz" é segura só enquanto a promessa dela for verdadeira: trocar de MARCA, nunca de
 * produto. Se ela aparecesse entre leite de caixinha e leite em pó, o cliente delegaria o preço e
 * receberia outra coisa — e descobriria na entrega. É isso que estes testes trancam.
 */

import { describe, expect, it } from 'bun:test'
import {
  areCandidatesInterchangeable,
  buildResolveSection,
  cheapestCandidate,
} from '@/modules/conversation/application/handlers/support/InteractiveListBuilders'
import { RESOLVE_ROW_ID } from '@/modules/conversation/shared/Messages.constant'

const arrozCamil = { productId: 'p1', name: 'Arroz Branco Tipo 1 5kg', brand: 'Camil', unitSize: '5kg', priceInCents: 2690, score: 1 }
const arrozPratoFino = { productId: 'p2', name: 'Arroz Branco Tipo 1 5kg', brand: 'Prato Fino', unitSize: '5kg', priceInCents: 2590, score: 1 }
const arrozTioJoao = { productId: 'p3', name: 'Arroz Branco Tipo 1 5kg', brand: 'Tio João', unitSize: '5kg', priceInCents: 2790, score: 1 }
const leiteCaixa = { productId: 'p4', name: 'Leite Integral 1L', brand: 'Italac', unitSize: '1L', priceInCents: 549, score: 1 }
const leitePo = { productId: 'p5', name: 'Leite em Pó Integral 400g', brand: 'Ninho', unitSize: '400g', priceInCents: 2290, score: 1 }

function pendingFor(candidates: readonly (typeof arrozCamil)[]) {
  return { originalTerm: 'arroz', quantity: 2, candidates } as never
}

describe('areCandidatesInterchangeable', () => {
  it('reconhece o mesmo produto em marcas diferentes', () => {
    expect(areCandidatesInterchangeable([arrozCamil, arrozPratoFino, arrozTioJoao])).toBe(true)
  })

  it('recusa produtos diferentes, mesmo com o termo em comum', () => {
    // "leite" casa com os dois, e delegar aqui trocaria caixinha por pó sem o cliente perceber.
    expect(areCandidatesInterchangeable([leiteCaixa, leitePo])).toBe(false)
  })

  it('recusa tamanhos diferentes do mesmo produto', () => {
    const arrozMenor = { ...arrozCamil, productId: 'p6', unitSize: '1kg', priceInCents: 690 }
    expect(areCandidatesInterchangeable([arrozCamil, arrozMenor])).toBe(false)
  })

  it('não oferece delegação para candidato único', () => {
    expect(areCandidatesInterchangeable([arrozCamil])).toBe(false)
    expect(areCandidatesInterchangeable([])).toBe(false)
  })
})

describe('cheapestCandidate', () => {
  it('devolve o de menor preço', () => {
    expect(cheapestCandidate([arrozCamil, arrozPratoFino, arrozTioJoao])?.productId).toBe('p2')
  })

  it('devolve undefined sem candidato', () => {
    expect(cheapestCandidate([])).toBeUndefined()
  })
})

describe('buildResolveSection', () => {
  it('ordena do mais barato para o mais caro', () => {
    const section = buildResolveSection(pendingFor([arrozCamil, arrozTioJoao, arrozPratoFino]))
    const prices = section.rows
      .map((row) => row.description)
      .filter((description): description is string => Boolean(description))

    // Com nomes iguais, o preço é a única coisa que o cliente compara.
    expect(prices[0]).toContain('25,90')
    expect(prices[2]).toContain('27,90')
  })

  it('oferece "tanto faz" quando muda só a marca', () => {
    const section = buildResolveSection(pendingFor([arrozCamil, arrozPratoFino]))
    expect(section.rows.some((row) => row.id === RESOLVE_ROW_ID.CHEAPEST)).toBe(true)
  })

  it('não oferece "tanto faz" entre produtos diferentes', () => {
    const section = buildResolveSection(pendingFor([leiteCaixa, leitePo]))
    expect(section.rows.some((row) => row.id === RESOLVE_ROW_ID.CHEAPEST)).toBe(false)
  })

  it('mantém "nenhum desses" como última saída', () => {
    const section = buildResolveSection(pendingFor([arrozCamil, arrozPratoFino]))
    expect(section.rows.at(-1)?.id).toBe(RESOLVE_ROW_ID.SKIP_ITEM)
  })
})
