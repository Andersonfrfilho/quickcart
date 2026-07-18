/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Stub de observabilidade: sem SENTRY_DSN configurado, apenas loga o erro desconhecido
 * (nunca deixa vazar stack trace pro cliente — isso é papel do exception filter do Router).
 * Trocar por @sentry/node real quando o projeto precisar de captura remota.
 */

import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'

const log = logger.child('Observability')

export function initSentry(): void {
  if (!environment.SENTRY_DSN) return
  log.warn('SENTRY_DSN configurado mas integração @sentry/node ainda não instalada neste MVP')
}

export function captureError(error: unknown): void {
  log.error('unhandled_error', {
    message: error instanceof Error ? error.message : String(error),
  })
}
