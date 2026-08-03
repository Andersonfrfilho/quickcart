/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O que este arquivo protege é uma decisão fácil de desfazer por boa intenção: alguém vê que
 * `complement` e `reference` não vão para o Maps, acha que é esquecimento, e acrescenta — piorando
 * a geocodificação sem nenhum sintoma visível.
 */

import { describe, expect, it } from 'bun:test'

import { buildMapsDestination, buildMapsUrl } from './orderMapsLink'

const STRUCTURED = {
  cep: '01310-100',
  street: 'Avenida Paulista',
  number: '1578',
  complement: 'apto 42',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
  reference: 'portão azul ao lado da padaria',
}

describe('buildMapsDestination — endereço estruturado', () => {
  it('monta rua, número, bairro, cidade/UF e CEP', () => {
    expect(buildMapsDestination({ address: STRUCTURED })).toBe(
      'Avenida Paulista, 1578, Bela Vista, São Paulo - SP, 01310-100',
    )
  })

  it('NÃO manda complemento — "apto 42" não ajuda o geocodificador a achar o prédio', () => {
    expect(buildMapsDestination({ address: STRUCTURED })).not.toContain('apto 42')
  })

  it('NÃO manda ponto de referência — é instrução para quem chega, não termo de busca', () => {
    const destination = buildMapsDestination({ address: STRUCTURED })

    expect(destination).not.toContain('portão azul')
    expect(destination).not.toContain('padaria')
  })

  it('funciona sem CEP: o pedido antigo estruturado pelo backfill pode não ter', () => {
    const { cep: _cep, ...withoutCep } = STRUCTURED

    expect(buildMapsDestination({ address: withoutCep })).toBe('Avenida Paulista, 1578, Bela Vista, São Paulo - SP')
  })

  it('preserva "s/n" e número com letra, que são endereços reais', () => {
    expect(buildMapsDestination({ address: { ...STRUCTURED, number: 's/n' } })).toContain('Avenida Paulista, s/n')
    expect(buildMapsDestination({ address: { ...STRUCTURED, number: '123A' } })).toContain('Avenida Paulista, 123A')
  })
})

describe('buildMapsDestination — endereço legado', () => {
  it('usa o texto original quando não há estrutura', () => {
    expect(buildMapsDestination({ address: null, fallbackText: 'Rua das Flores 123, centro' })).toBe(
      'Rua das Flores 123, centro',
    )
  })

  it('ignora o texto legado quando existe estrutura — a estrutura geocodifica melhor', () => {
    const destination = buildMapsDestination({ address: STRUCTURED, fallbackText: 'manda na rua de trás do posto' })

    expect(destination).not.toContain('rua de trás do posto')
  })

  it('devolve undefined sem endereço nenhum, para a tela esconder o botão', () => {
    expect(buildMapsDestination({ address: null })).toBeUndefined()
    expect(buildMapsDestination({ address: undefined, fallbackText: '   ' })).toBeUndefined()
    expect(buildMapsDestination({ address: {} })).toBeUndefined()
  })

  it('endereço parcial não passa por estruturado — cairia em busca sem cidade', () => {
    // O `{ street: "..." }` que o checkout web antigo gravava.
    expect(buildMapsDestination({ address: { street: 'Rua A' }, fallbackText: 'Rua A, 10' })).toBe('Rua A, 10')
  })
})

describe('buildMapsUrl', () => {
  it('escapa o destino — vírgula, espaço e acento vão em pedaço de query', () => {
    const url = buildMapsUrl('Avenida Paulista, 1578, São Paulo - SP')

    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Avenida%20Paulista%2C%201578%2C%20S%C3%A3o%20Paulo%20-%20SP',
    )
  })

  it('usa dir e não search: quem abre está indo entregar', () => {
    expect(buildMapsUrl('x')).toContain('/maps/dir/')
  })

  it('um "&" no endereço não vira parâmetro novo na URL', () => {
    // Endereço legado é texto livre digitado por cliente — pode ter qualquer caractere.
    const url = buildMapsUrl('Rua A & B, 10')

    expect(url.split('&')).toHaveLength(2)
    expect(url).toContain('%26')
  })
})
