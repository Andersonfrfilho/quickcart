/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { sttQueue, receiptQueue, notificationQueue } from './queues'
import { logger } from '@/shared/logger'

const log = logger.child('QueueCleanup')

const CLEANUP_INTERVAL_MS = 6 * 3600 * 1000

// Backstop além do removeOnComplete/removeOnFail por job — garante a retenção mesmo se as
// opções de um job específico forem configuradas incorretamente no futuro.
async function runCleanup(): Promise<void> {
  await sttQueue.clean(24 * 3600 * 1000, 500, 'completed')
  await sttQueue.clean(7 * 24 * 3600 * 1000, 1000, 'failed')
  await receiptQueue.clean(30 * 24 * 3600 * 1000, 2000, 'completed')
  await receiptQueue.clean(90 * 24 * 3600 * 1000, 2000, 'failed')
  await notificationQueue.clean(24 * 3600 * 1000, 1000, 'completed')
  await notificationQueue.clean(7 * 24 * 3600 * 1000, 2000, 'failed')
  log.debug('cleanup_cycle_complete')
}

export function startQueueCleanup(): NodeJS.Timeout {
  return setInterval(() => {
    runCleanup().catch((error) => log.error('cleanup_failed', { error: String(error) }))
  }, CLEANUP_INTERVAL_MS)
}
