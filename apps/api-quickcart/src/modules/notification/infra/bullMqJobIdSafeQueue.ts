/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * REMENDO TEMPORÁRIO, com data de saída: o adaptador BullMQ do `notification-module` monta
 * `jobId: \`${deliveryId}:${attempt}\``, e o BullMQ recusa `:` em id customizado ("Custom Id cannot
 * contain :") porque usa `:` nas próprias chaves do Redis. O `add` lançava antes de escrever nada, e
 * como o enfileiramento acontece dentro da operação que dispara o aviso, a exceção subia: confirmar
 * pedido respondia 500 e a mudança de status não acontecia.
 *
 * O `:` já tinha mordido este repositório uma vez, no `mediaJobId` do webhook — a mesma nota está em
 * `metaWhatsAppModule.ts`.
 *
 * A correção está feita no fonte do pacote (`src/queue/bullmq.ts`, separador `_`) e sai no próximo
 * rc. Quando esse rc estiver pinado aqui, este arquivo e seu uso em `notificationModule.ts` devem ser
 * apagados — o host não deve corrigir o pacote por fora, e manter os dois é como as versões
 * divergem.
 */

import type { Queue } from 'bullmq'

const BULLMQ_FORBIDDEN_IN_JOB_ID = /:/g

type QueueAddParameters = Parameters<Queue['add']>

/**
 * Envolve a fila trocando `:` por `_` no `jobId`, e passa tudo o mais adiante. Só o `jobId` muda: a
 * identidade do job continua sendo entrega + tentativa, então a idempotência de enfileiramento que o
 * pacote quis continua valendo.
 */
export function withBullMqSafeJobId(queue: Queue): Queue {
  return new Proxy(queue, {
    get(target, property, receiver) {
      if (property !== 'add') return Reflect.get(target, property, receiver)

      return (...[name, data, options]: QueueAddParameters) => {
        const jobId = options?.jobId
        const safeOptions =
          typeof jobId === 'string' && jobId.includes(':')
            ? { ...options, jobId: jobId.replace(BULLMQ_FORBIDDEN_IN_JOB_ID, '_') }
            : options

        return target.add(name, data, safeOptions)
      }
    },
  })
}
