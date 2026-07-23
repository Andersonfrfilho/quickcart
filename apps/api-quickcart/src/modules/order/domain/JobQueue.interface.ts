/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Porta mínima sobre a fila BullMQ (`infra/queue/queues.ts`) — os use-cases do módulo
 * Order dependem só de `add`, nunca da classe `Queue` concreta, para permitir fakes em
 * testes unitários sem subir Redis.
 */

export interface JobQueue {
  add(name: string, data: Record<string, unknown>): Promise<unknown>
}
