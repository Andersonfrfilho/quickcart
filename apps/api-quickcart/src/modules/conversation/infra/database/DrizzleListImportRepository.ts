/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { db } from '@/infra/database/connection'
import { listImports, type ListImport } from '@/infra/database/schema'
import type {
  CreateListImportParams,
  ListImportRepositoryInterface,
} from '@/modules/conversation/domain/ListImportRepository.interface'

export class DrizzleListImportRepository implements ListImportRepositoryInterface {
  async create(params: CreateListImportParams): Promise<ListImport> {
    const [listImport] = await db
      .insert(listImports)
      .values({
        id: params.id,
        sessionId: params.sessionId,
        source: params.source,
        rawText: params.rawText,
        transcript: params.transcript ?? null,
        parseResult: params.parseResult,
        matchedCount: params.matchedCount,
        ambiguousCount: params.ambiguousCount,
        unmatchedCount: params.unmatchedCount,
      })
      .returning()

    return listImport as ListImport
  }
}
