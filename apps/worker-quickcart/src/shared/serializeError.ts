/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

/**
 * Node wraps multi-address connection failures (e.g. "localhost" resolving to both
 * ::1 and 127.0.0.1) in an AggregateError whose top-level .message is empty — the
 * real reason lives in .errors. Fall back to .name when .message is empty for any Error.
 */
export function serializeError(error: unknown): string {
  if (error instanceof AggregateError) {
    return error.errors.map((nested) => serializeError(nested)).join('; ') || error.message || error.name
  }
  if (error instanceof Error) {
    return error.message || error.name
  }
  return String(error)
}
