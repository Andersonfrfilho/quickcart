/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Quando vale a pena perguntar de novo pelo pedido.
 *
 * A pergunta que este arquivo responde não é "de quanto em quanto tempo", é "existe alguém além desta
 * tela que pode mudar este pedido agora?". Quase sempre a resposta é não: o pedido terminou, ou só
 * muda quando quem está olhando toca em alguma coisa — e aí a resposta do próprio PATCH já atualiza.
 *
 * Bater na API a cada poucos segundos em todo pedido aberto seria, numa loja com trinta pedidos e
 * quatro tablets, alguns milhares de requisições por hora para dizer "nada mudou".
 */

import { ORDER_STATUS, type OrderStatus } from '@/shared/api/api.types'

/**
 * O único estado em que a mudança vem de fora sem aviso de tela: o cliente está com a pergunta no
 * WhatsApp e responde quando quiser. É aqui que a tela mentiria por mais tempo, e é o único caso que
 * justifica perguntar de poucos em poucos segundos.
 */
const AWAITING_CUSTOMER_REFETCH_INTERVAL_MS = 5_000

/**
 * Os demais estados vivos mudam por outro operador — outro tablet marcando item, alguém adiantando o
 * status no balcão. Importa, mas não é urgente ao ponto de valer polling curto: meio minuto é menos
 * que o tempo de atravessar a loja.
 */
const ACTIVE_ORDER_REFETCH_INTERVAL_MS = 30_000

/** Nada mais acontece com o pedido — perguntar é gastar bateria para receber a mesma resposta. */
const SETTLED_STATUSES: ReadonlySet<string> = new Set([ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED])

export type ResolveOrderRefetchIntervalParams = {
  readonly status: OrderStatus | undefined
  /**
   * Com o stream de pé o polling é desligado inteiro: o push já chega em menos de um segundo, e
   * manter os dois seria pagar as duas contas para receber a mesma notícia duas vezes.
   */
  readonly isRealtimeConnected: boolean
}

/** `false` no lugar de zero porque é o que o react-query entende por "não repetir". */
export function resolveOrderRefetchInterval(params: ResolveOrderRefetchIntervalParams): number | false {
  if (params.isRealtimeConnected) return false
  if (!params.status) return false
  if (SETTLED_STATUSES.has(params.status)) return false

  return params.status === ORDER_STATUS.AWAITING_CUSTOMER_DECISION
    ? AWAITING_CUSTOMER_REFETCH_INTERVAL_MS
    : ACTIVE_ORDER_REFETCH_INTERVAL_MS
}
