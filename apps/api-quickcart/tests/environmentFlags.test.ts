/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * `PREVIEW_TRANSCRIPT_ENABLED` usava `z.coerce.boolean()`, que é `Boolean(valor)`: escrever "false"
 * no painel do ambiente LIGAVA as rotas de preview — transcript de cliente legível sem sessão de
 * admin. O gesto de endurecer o ambiente era o gesto que o abria. Este teste é o que prova que
 * nenhuma flag voltou a coerção.
 */

import { describe, expect, it } from 'bun:test'
import { environmentSchema } from '@/infra/config/environment'

const REQUIRED_ENVIRONMENT = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/quickcart',
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify-token',
  NOTIFICATION_SUPPRESSION_KEY: 'a'.repeat(32),
  INTERNAL_API_TOKEN: 'internal-token',
} as const

const BOOLEAN_FLAGS = [
  'PREVIEW_TRANSCRIPT_ENABLED',
  'MODERATION_ENABLED',
  'TRANSCRIPTION_ENABLED',
  'TRANSCRIPTION_LOCAL_FALLBACK_ENABLED',
  'STORAGE_ENABLED',
  'STORAGE_FORCE_PATH_STYLE',
  'FISCAL_ENABLED',
] as const

describe('environmentSchema — flags booleanas', () => {
  it('lê "false" como desligado em toda flag', () => {
    const parsed = environmentSchema.parse({
      ...REQUIRED_ENVIRONMENT,
      ...Object.fromEntries(BOOLEAN_FLAGS.map((flag) => [flag, 'false'])),
    })

    for (const flag of BOOLEAN_FLAGS) {
      expect(parsed[flag]).toBe(false)
    }
  })

  it('lê "true" como ligado em toda flag', () => {
    const parsed = environmentSchema.parse({
      ...REQUIRED_ENVIRONMENT,
      ...Object.fromEntries(BOOLEAN_FLAGS.map((flag) => [flag, 'true'])),
    })

    for (const flag of BOOLEAN_FLAGS) {
      expect(parsed[flag]).toBe(true)
    }
  })

  it('mantém o preview desligado quando a variável não existe', () => {
    const parsed = environmentSchema.parse(REQUIRED_ENVIRONMENT)
    expect(parsed.PREVIEW_TRANSCRIPT_ENABLED).toBe(false)
    expect(parsed.STORAGE_ENABLED).toBe(false)
  })

  it('recusa subir sem as variáveis que não têm default', () => {
    for (const key of Object.keys(REQUIRED_ENVIRONMENT)) {
      const incomplete = { ...REQUIRED_ENVIRONMENT } as Record<string, string>
      delete incomplete[key]
      expect(() => environmentSchema.parse(incomplete)).toThrow()
    }
  })
})
