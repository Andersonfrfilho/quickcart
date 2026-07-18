/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { z } from 'zod'
import { ValidationError } from '@/shared/errors/AppError.error'

export function validateQuery<TSchema extends z.ZodType>(schema: TSchema, query: URLSearchParams): z.infer<TSchema> {
  const rawQuery = Object.fromEntries(query.entries())
  const result = schema.safeParse(rawQuery)

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new ValidationError(message || 'Validation error')
  }

  return result.data
}
