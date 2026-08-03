/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * `String(endereçoEstruturado)` virava "[object Object]" no WhatsApp assim que o checkout passou a
 * guardar objeto (T2.2) — este teste é o que prova que não voltou.
 */

import { describe, expect, it } from 'bun:test'
import { formatAddressLine } from '@/modules/shared/address/formatAddressLine'

describe('formatAddressLine', () => {
  it('formata endereço estruturado com complemento', () => {
    const line = formatAddressLine({
      cep: '01415-000',
      street: 'Rua das Acácias',
      number: '412',
      complement: 'apto 71',
      neighborhood: 'Jardim Paulista',
      city: 'São Paulo',
      state: 'SP',
    })
    expect(line).toBe('Rua das Acácias, 412 - apto 71 — Jardim Paulista, São Paulo/SP')
  })

  it('formata endereço estruturado sem complemento', () => {
    const line = formatAddressLine({
      street: 'Rua das Acácias',
      number: '412',
      neighborhood: 'Jardim Paulista',
      city: 'São Paulo',
      state: 'SP',
    })
    expect(line).toBe('Rua das Acácias, 412 — Jardim Paulista, São Paulo/SP')
  })

  it('cai para o texto quando o endereço é string crua (checkout de antes de T2.2)', () => {
    expect(formatAddressLine('Rua das Acácias, 412, apto 71')).toBe('Rua das Acácias, 412, apto 71')
  })

  it('não inventa endereço quando não há nenhum', () => {
    expect(formatAddressLine(null)).toBeUndefined()
    expect(formatAddressLine(undefined)).toBeUndefined()
    expect(formatAddressLine('')).toBeUndefined()
  })

  it('não trata objeto incompleto como estruturado — evitaria "undefined" na frase', () => {
    expect(formatAddressLine({ street: 'Rua das Acácias' })).toBeUndefined()
  })
})
