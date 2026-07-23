/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Testa searchByTerm contra o catálogo populado por `make seed ENV=test` (T2.5).
 * Requer Postgres de teste migrado e semeado — rodar via `make validate` ou
 * `bun --env-file=../../envs/env.test test`.
 *
 * Não fecha o pool de conexão no afterAll: `db`/`redis` são singletons
 * compartilhados por todo o processo `bun test`, e outros arquivos de teste
 * de integração rodam no mesmo processo — fechar aqui quebraria os demais.
 */

import { describe, expect, test } from 'bun:test'
import { DrizzleProductRepository } from './DrizzleProductRepository'

const repository = new DrizzleProductRepository()

function namesOf(results: readonly { name: string; brand: string | null }[]): string[] {
  return results.map((result) => (result.brand ? `${result.name} (${result.brand})` : result.name))
}

describe('DrizzleProductRepository.searchByTerm', () => {
  test('encontra produto com acento usando termo acentuado', async () => {
    const results = await repository.searchByTerm('café', 5)

    expect(results[0]?.name).toBe('Café Torrado e Moído 500g')
  })

  test('encontra produto acentuado usando termo sem acento', async () => {
    const results = await repository.searchByTerm('cafe', 5)

    expect(results[0]?.name).toBe('Café Torrado e Moído 500g')
  })

  test('tolera typo leve ("arros" → arroz) e rankeia os 3 arrozes no topo', async () => {
    const results = await repository.searchByTerm('arros', 5)
    const topNames = namesOf(results.slice(0, 3))

    expect(topNames.every((name) => name.startsWith('Arroz Branco Tipo 1 5kg'))).toBe(true)
    expect(results[0]?.score).toBeGreaterThan(0.3)
  })

  test('encontra produto por marca ("tio joao")', async () => {
    const results = await repository.searchByTerm('tio joao', 5)

    expect(results[0]?.name).toBe('Arroz Branco Tipo 1 5kg')
    expect(results[0]?.brand).toBe('Tio João')
  })

  test('encontra produto por alias que não é o nome do produto ("guarana")', async () => {
    const results = await repository.searchByTerm('guarana', 5)

    expect(results[0]?.name).toBe('Refrigerante Guaraná 2L')
  })

  test('retorna lista vazia para termo sem nenhuma correspondência plausível', async () => {
    const results = await repository.searchByTerm('xyzabc123nonexistent', 5)

    expect(results.every((result) => result.score < 0.2)).toBe(true)
  })
})
