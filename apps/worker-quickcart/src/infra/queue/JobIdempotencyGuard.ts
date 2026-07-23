/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Guarda de idempotência genérica para processors (BullMQ entrega no mínimo uma vez —
 * ver worker.md). A marca só deve ser gravada depois do efeito colateral ter sucesso:
 * marcar antes faria uma falha transitória parecer "já processado" e o job nunca seria
 * efetivamente refeito em um retry.
 */

import { queueConnection } from '@/infra/queue/connection'

const PROCESSED_TTL_SECONDS = 24 * 60 * 60

export async function wasProcessed(key: string): Promise<boolean> {
  const value = await queueConnection.get(key)
  return value !== null
}

export async function markProcessed(key: string): Promise<void> {
  await queueConnection.set(key, '1', 'EX', PROCESSED_TTL_SECONDS)
}
