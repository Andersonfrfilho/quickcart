/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { ParsedRequest } from '@/infra/http/router'
import { environment } from '@/infra/config/environment'
import { UnauthorizedError } from '@/shared/errors/AppError.error'
import { INTERNAL_TOKEN_INVALID } from '@/shared/errors/codes'

const BEARER_PREFIX = 'Bearer '

export function requireInternalToken(request: ParsedRequest): void {
  const header = request.headers['authorization']
  const token = header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : undefined

  if (!token || token !== environment.INTERNAL_API_TOKEN) {
    throw new UnauthorizedError('Invalid or missing internal token', INTERNAL_TOKEN_INVALID)
  }
}
