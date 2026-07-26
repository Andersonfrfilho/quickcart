/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Portas de realtime do SseHub. O relay via Redis pub/sub não é detalhe opcional: com mais de
 * uma instância da API atrás do balanceador, um evento emitido no pod A nunca chegaria ao
 * navegador conectado no pod B — a inbox pareceria funcionar em desenvolvimento e ficaria
 * mostrando dados velhos em produção, sem erro nenhum.
 */

import { SseHub, type RealtimeRelay, type TicketStoreInterface } from '@adatechnology/meta-whatsapp-module'
import { redis } from '@/infra/redis/connection'
import { logger } from '@/shared/logger'

const realtimeLog = logger.child('ConversationRealtime')

// Conexão dedicada: um client ioredis em modo subscribe não aceita mais nenhum outro comando,
// então não dá para reusar o client de cache.
function createRelay(): RealtimeRelay {
  const subscriber = redis.duplicate()

  return {
    async publish(channel: string, message: string): Promise<void> {
      await redis.publish(channel, message)
    },
    async subscribe(channel: string, onMessage: (message: string) => void): Promise<() => void> {
      const handler = (incomingChannel: string, message: string): void => {
        if (incomingChannel === channel) onMessage(message)
      }

      subscriber.on('message', handler)
      await subscriber.subscribe(channel)
      realtimeLog.info('relay_subscribed', { channel })

      return () => {
        subscriber.off('message', handler)
        void subscriber.unsubscribe(channel)
      }
    },
  }
}

export const conversationSseHub = new SseHub(createRelay())

// O TicketStore é o cache normal; só o nome do delete diverge do contrato do módulo.
export const conversationTicketStore: TicketStoreInterface = {
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await redis.set(key, value, 'EX', ttlSeconds)
  },
  async get(key: string): Promise<string | null> {
    return redis.get(key)
  },
  async delete(key: string): Promise<void> {
    await redis.del(key)
  },
}
