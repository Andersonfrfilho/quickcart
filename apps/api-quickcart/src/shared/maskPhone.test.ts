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

import { maskPhone } from '@/shared/maskPhone'

describe('maskPhone', () => {
  it('mantém só os 4 últimos dígitos', () => {
    expect(maskPhone('5516993056772')).toBe('****6772')
  })

  it('remove formatação antes de mascarar', () => {
    expect(maskPhone('(16) 99305-6772')).toBe('****6772')
  })

  it('devolve só a máscara quando não há dígito suficiente', () => {
    expect(maskPhone('123')).toBe('****')
  })

  it('devolve só a máscara para valor ausente', () => {
    expect(maskPhone(undefined)).toBe('****')
    expect(maskPhone(null)).toBe('****')
    expect(maskPhone('')).toBe('****')
  })
})
