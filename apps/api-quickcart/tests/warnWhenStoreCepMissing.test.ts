/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Aviso de boot quando `STORE_CEP` falta (spec §3.1): log estruturado, sem CEP nem outro dado pessoal.
 */

import { describe, expect, it, spyOn } from 'bun:test'

import { STORE_CEP_MISSING_EVENT, warnWhenStoreCepMissing } from '@/infra/config/warnWhenStoreCepMissing'
import { Logger } from '@/shared/logger'

describe('warnWhenStoreCepMissing', () => {
  it('sem STORE_CEP emite warn estruturado', () => {
    const warnSpy = spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
    try {
      warnWhenStoreCepMissing(undefined)
      expect(warnSpy.mock.calls).toEqual([[STORE_CEP_MISSING_EVENT, { deliveryAvailable: false }]])
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('com STORE_CEP não avisa', () => {
    const warnSpy = spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
    try {
      warnWhenStoreCepMissing('01415-000')
      expect(warnSpy.mock.calls).toEqual([])
    } finally {
      warnSpy.mockRestore()
    }
  })
})
