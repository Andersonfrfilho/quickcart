/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

type RequestContext = {
  readonly traceId: string
}

const storage = new AsyncLocalStorage<RequestContext>()

export function runWithContext<TResult>(fn: () => Promise<TResult>): Promise<TResult> {
  return storage.run({ traceId: randomUUID().slice(0, 8) }, fn)
}

export function getTraceId(): string | undefined {
  return storage.getStore()?.traceId
}
