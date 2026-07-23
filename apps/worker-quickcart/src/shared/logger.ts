/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { environment } from '@/infra/config/environment'

const LOG_LEVEL_WEIGHT = { debug: 0, info: 1, warn: 2, error: 3 } as const
type LogLevel = keyof typeof LOG_LEVEL_WEIGHT

const CURRENT_LEVEL_WEIGHT: number = LOG_LEVEL_WEIGHT[environment.LOG_LEVEL]
const APP_NAME = 'worker-quickcart'

export class Logger {
  constructor(private readonly contexts: readonly string[] = []) {}

  child(...contexts: string[]): Logger {
    return new Logger([...this.contexts, ...contexts])
  }

  private format(level: LogLevel, message: string, meta?: unknown): string {
    const context = this.contexts.map((entry) => `[${entry}]`).join('')
    const metaSuffix = meta !== undefined ? ` - ${JSON.stringify(meta)}` : ''
    return `[${new Date().toISOString()}][${APP_NAME}]${context}[${level.toUpperCase()}] - ${message}${metaSuffix}`
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
