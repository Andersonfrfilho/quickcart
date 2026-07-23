/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { ListImport } from '@/infra/database/schema'
import type { ListImportSource } from '@/modules/conversation/shared/ListImport.constant'

export type CreateListImportParams = {
  readonly id: string
  readonly sessionId: string
  readonly source: ListImportSource
  readonly rawText: string
  readonly transcript?: string | undefined
  readonly parseResult: unknown
  readonly matchedCount: number
  readonly ambiguousCount: number
  readonly unmatchedCount: number
}

export interface ListImportRepositoryInterface {
  create(params: CreateListImportParams): Promise<ListImport>
}
