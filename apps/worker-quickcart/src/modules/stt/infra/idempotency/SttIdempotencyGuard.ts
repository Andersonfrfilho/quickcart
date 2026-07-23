/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Chaveado no mediaId do WhatsApp (estável entre reentregas do mesmo job), não no job.id.
 */

import { markProcessed, wasProcessed } from '@/infra/queue/JobIdempotencyGuard'

const KEY_PREFIX = 'stt:processed:'

export async function wasSttJobProcessed(mediaId: string): Promise<boolean> {
  return wasProcessed(`${KEY_PREFIX}${mediaId}`)
}

export async function markSttJobProcessed(mediaId: string): Promise<void> {
  await markProcessed(`${KEY_PREFIX}${mediaId}`)
}
