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

import { maskCep } from '@/shared/maskCep'
import { serializeError } from '@/shared/serializeError'

describe('serializeError — redação de PII na mensagem de erro', () => {
  it('redige o CEP que o fetch do provedor coloca na URL', () => {
    const error = new TypeError('fetch failed: https://nominatim.example/search?postalcode=14010-000&country=Brazil')

    const serialized = serializeError(error)

    expect(serialized).not.toContain('14010')
    expect(serialized).toContain('[REDACTED_CEP]')
  })

  it('redige e-mail e telefone', () => {
    const serialized = serializeError(new Error('recipient joana@example.com rejected; wa_id 5516993056772 invalid'))

    expect(serialized).toBe('recipient [REDACTED_EMAIL] rejected; wa_id [REDACTED_PHONE] invalid')
  })

  it('redige dentro de AggregateError e mantém o diagnóstico', () => {
    const error = new AggregateError([new Error('connect ECONNREFUSED ::1:5432'), new Error('cep 14010000 invalid')])

    expect(serializeError(error)).toBe('connect ECONNREFUSED ::1:5432; cep [REDACTED_CEP] invalid')
  })

  it('não mexe em mensagem sem PII', () => {
    expect(serializeError(new Error('Request timeout after 5000ms'))).toBe('Request timeout after 5000ms')
  })
})

describe('maskCep', () => {
  it('mantém só os 3 primeiros dígitos', () => {
    expect(maskCep('14010-000')).toBe('140*****')
  })

  it('CEP ausente vira máscara inteira', () => {
    expect(maskCep(undefined)).toBe('********')
  })
})
