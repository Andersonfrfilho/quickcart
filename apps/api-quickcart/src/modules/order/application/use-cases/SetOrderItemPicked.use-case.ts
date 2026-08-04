/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Marca item separado — no servidor, para a tela contar a mesma coisa em qualquer aparelho.
 *
 * A marcação vivia em `localStorage`: separar no tablet do balcão e abrir no celular no corredor
 * mostrava "0/2 separados" num pedido cuja esteira já dizia "Separado". Quem chegava depois não tinha
 * como saber qual das duas era verdade.
 *
 * Diferente da falta, isto NÃO recalcula total nem avisa o cliente: separar não muda o que ele paga.
 * Por isso o use case é fino — a regra que existe é qual item pode ser marcado, e ela mora no estado do
 * pedido, não aqui.
 */

import { OrderNotFoundError } from '@/shared/errors/OrderErrors'
import { OrderInvalidStatusTransitionError } from '@/shared/errors/OrderErrors'
import { ORDER_STATUS } from '@/modules/order/shared/Order.constant'
import type { OrderDetail, OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'

/**
 * Estados em que marcar item faz sentido.
 *
 * Antes da separação começar, a lista é leitura: registrar trabalho que não aconteceu confundiria quem
 * abre depois. Com a sacola na rua ou o pedido concluído, marcar não muda mais nada no mundo — só
 * permitiria reescrever o passado.
 *
 * A regra estava só no frontend (`resolvePickingState`), onde uma aba velha a contornava. Agora o
 * servidor recusa, e a tela continua desenhando a partir do que ele permite.
 */
const PICKING_ALLOWED_STATUSES: ReadonlySet<string> = new Set([ORDER_STATUS.PREPARING, ORDER_STATUS.SEPARATED])

type SetOrderItemPickedDependencies = {
  readonly orderRepository: OrderRepositoryInterface
}

export type SetOrderItemPickedParams = {
  readonly orderId: string
  /** Ausente = todos os itens de uma vez ("marcar todos" / "limpar marcações"). */
  readonly itemId?: string | undefined
  readonly picked: boolean
}

export class SetOrderItemPickedUseCase {
  constructor(private readonly dependencies: SetOrderItemPickedDependencies) {}

  async execute(params: SetOrderItemPickedParams): Promise<OrderDetail> {
    const before = await this.dependencies.orderRepository.findDetailById(params.orderId)
    if (!before) throw new OrderNotFoundError(params.orderId)

    if (!PICKING_ALLOWED_STATUSES.has(before.order.status)) {
      /*
       * 409 na rota: não é pedido inexistente nem corpo inválido — é o pedido estar em outro momento.
       * `allowedNextStatuses` vazio porque não há transição a oferecer: o que falta não é mudar de
       * status, é a separação não valer mais neste estado.
       */
      throw new OrderInvalidStatusTransitionError({
        currentStatus: before.order.status,
        nextStatus: before.order.status,
        allowedNextStatuses: [],
      })
    }

    if (params.itemId !== undefined) {
      const item = before.items.find((candidate) => candidate.id === params.itemId)
      if (!item) throw new OrderNotFoundError(params.orderId)

      /*
       * Item em falta não se separa: ele não está na sacola.
       *
       * Marcar faria o progresso contar como pronto algo que o cliente não vai receber — e é justamente
       * o número que decide avançar o pedido para "separado".
       */
      if (params.picked && item.unavailableAt !== null) return before

      const detail = await this.dependencies.orderRepository.setItemPicked({
        orderId: params.orderId,
        itemId: params.itemId,
        picked: params.picked,
      })
      if (!detail) throw new OrderNotFoundError(params.orderId)
      return detail
    }

    const detail = await this.dependencies.orderRepository.setAllItemsPicked({
      orderId: params.orderId,
      picked: params.picked,
    })
    if (!detail) throw new OrderNotFoundError(params.orderId)
    return detail
  }
}
