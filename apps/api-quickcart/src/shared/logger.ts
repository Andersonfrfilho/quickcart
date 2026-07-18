/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Logger estruturado seguindo a máscara padronizada:
 * [traceId][timestamp][appName][traceStack...][source][lib][LEVEL] - message - meta
 */

import { getTraceId } from './request-context'
import { environment } from '@/infra/config/environment'

const LOG_LEVEL_WEIGHT = { debug: 0, info: 1, warn: 2, error: 3 } as const
type LogLevel = keyof typeof LOG_LEVEL_WEIGHT

const CURRENT_LEVEL_WEIGHT: number = LOG_LEVEL_WEIGHT[environment.LOG_LEVEL]
const APP_NAME = 'api-quickcart'

const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'x-admin-token', 'x-internal-token'])

export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[REDACTED]' : value,
    ]),
  )
}

export class Logger {
  constructor(private readonly contexts: readonly string[] = []) {}

  child(...contexts: string[]): Logger {
    return new Logger([...this.contexts, ...contexts])
  }

  private format(level: LogLevel, message: string, meta?: unknown): string {
    const timestamp = `[${new Date().toISOString()}]`
    const traceId = getTraceId()
    const trace = traceId ? `[${traceId}]` : ''
    const app = `[${APP_NAME}]`
    const context = this.contexts.map((entry) => `[${entry}]`).join('')
    const levelTag = `[${level.toUpperCase()}]`
    const tail = meta !== undefined ? ` - ${JSON.stringify(meta)}` : ''

    return `${trace}${timestamp}${app}${context}${levelTag} - ${message}${tail}`
  }

  private write(level: LogLevel, message: string, meta?: unknown): void {
    if (LOG_LEVEL_WEIGHT[level] < CURRENT_LEVEL_WEIGHT) return
    const line = this.format(level, message, meta)
    if (level === 'error') console.error(line)
    else console.log(line)
  }

  debug(message: string, meta?: unknown): void { this.write('debug', message, meta) }
  info(message: string, meta?: unknown): void { this.write('info', message, meta) }
  warn(message: string, meta?: unknown): void { this.write('warn', message, meta) }
  error(message: string, meta?: unknown): void { this.write('error', message, meta) }
}

export const logger = new Logger()
