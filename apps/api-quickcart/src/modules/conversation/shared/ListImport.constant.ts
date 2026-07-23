/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

export const LIST_IMPORT_SOURCE = {
  TEXT: 'text',
  AUDIO: 'audio',
  WEB: 'web',
} as const

export type ListImportSource = (typeof LIST_IMPORT_SOURCE)[keyof typeof LIST_IMPORT_SOURCE]
