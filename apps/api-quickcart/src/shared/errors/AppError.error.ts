/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import {
  UNAUTHORIZED,
  FORBIDDEN,
  NOT_FOUND,
  CONFLICT,
  VALIDATION_ERROR,
  TOO_MANY_REQUESTS,
  INTERNAL_ERROR,
} from './codes'

export class AppError extends Error {
  constructor(
    public override readonly message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = UNAUTHORIZED) {
    super(message, 401, code)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code = FORBIDDEN) {
    super(message, 403, code)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found', code = NOT_FOUND) {
    super(message, 404, code)
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', code = CONFLICT) {
    super(message, 409, code)
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation error', code = VALIDATION_ERROR) {
    super(message, 422, code)
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', retryAfterSeconds = 60, code = TOO_MANY_REQUESTS) {
    super(message, 429, code)
    this.retryAfterSeconds = retryAfterSeconds
  }

  public readonly retryAfterSeconds: number
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error', code = INTERNAL_ERROR) {
    super(message, 500, code)
  }
}
