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

import { RATE_LIMIT_UNKNOWN_CLIENT } from './rateLimit.constant'
import { resolveClientIp } from './resolveClientIp'

describe('resolveClientIp', () => {
  it('usa X-Real-IP, que o edge do Railway preenche', () => {
    expect(resolveClientIp({ 'x-real-ip': '203.0.113.7' })).toBe('203.0.113.7')
  })

  it('X-Forwarded-For forjado NÃO muda a chave quando há X-Real-IP — era o furo', () => {
    const forjado = resolveClientIp({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '10.9.0.1' })
    const outroForjado = resolveClientIp({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '10.9.0.2, 10.9.0.3' })

    expect(forjado).toBe('203.0.113.7')
    expect(outroForjado).toBe('203.0.113.7')
  })

  it('sem edge (local), cai no último salto do X-Forwarded-For', () => {
    expect(resolveClientIp({ 'x-forwarded-for': '198.51.100.1, 198.51.100.2' })).toBe('198.51.100.2')
  })

  it('X-Real-IP vazio ou só espaço não é aceito como IP', () => {
    expect(resolveClientIp({ 'x-real-ip': '   ', 'x-forwarded-for': '198.51.100.9' })).toBe('198.51.100.9')
  })

  it('sem nenhum header, usa a chave de cliente desconhecido', () => {
    expect(resolveClientIp({})).toBe(RATE_LIMIT_UNKNOWN_CLIENT)
  })
})
