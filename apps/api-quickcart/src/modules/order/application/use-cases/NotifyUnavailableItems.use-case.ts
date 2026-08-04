/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Avisa o cliente das faltas do pedido, em UMA mensagem, quando a loja decidir avisar.
 *
 * Antes, marcar um item como em falta mandava a mensagem no mesmo instante. Quem separa uma compra de mês
 * marca três ou quatro itens andando pelo corredor, e o cliente recebia uma mensagem por item — cada uma
 * anunciando um total diferente, todas fora de ordem em relação ao que ainda ia ser descoberto. E a loja
 * não tinha como reler o recado antes de ele sair.
 *
 * Agora marcar é registro interno; avisar é ação explícita de quem separa, com tudo junto e o total final.
 *
 * Idempotente por construção: só entram os itens em falta AINDA não avisados. Dois cliques no botão não
 * mandam dois recados, e um item marcado depois do primeiro aviso entra no segundo.
 */

import { OrderNotFoundError } from '@/shared/errors/OrderErrors'
import type { OrderDetail, OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const useCaseLog = logger.child('NotifyUnavailableItems')

type NotifyUnavailableItemsDependencies = {
  readonly orderRepository: OrderRepositoryInterface
  readonly notifyCustomer: (params: { readonly whatsappNumber: string; readonly body: string }) => Promise<void>
}

export type NotifyUnavailableItemsResult = {
  readonly detail: OrderDetail
  /** Quantos itens entraram no recado. Zero significa que não havia nada novo a avisar. */
  readonly notifiedCount: number
}

export class NotifyUnavailableItemsUseCase {
  constructor(private readonly dependencies: NotifyUnavailableItemsDependencies) {}

  async execute(params: { readonly orderId: string }): Promise<NotifyUnavailableItemsResult> {
    const detail = await this.dependencies.orderRepository.findDetailById(params.orderId)
    if (!detail) throw new OrderNotFoundError(params.orderId)

    const pending = detail.items.filter(
      (item) => item.unavailableAt !== null && item.unavailableNotifiedAt === null,
    )
    if (pending.length === 0) return { detail, notifiedCount: 0 }

    const itemLines = pending.map((item) => `• ${Number(item.quantity)}x ${item.productName}`).join('\n')
    const hasAnythingLeft = detail.items.some((item) => item.unavailableAt === null)

    /**
     * Nada sobrou: outra conversa, não o mesmo recado com total zero.
     *
     * "O novo total é R$ 0,00" deixaria o cliente esperando uma entrega vazia. Quando não há o que
     * entregar, a pergunta certa é se ele quer montar outra lista ou cancelar.
     */
    const body = hasAnythingLeft
      ? MESSAGES.ORDER_ITEMS_UNAVAILABLE.replace('{itens}', itemLines).replace(
          '{total}',
          formatPriceInCents(detail.order.totalInCents),
        )
      : MESSAGES.ORDER_ALL_ITEMS_UNAVAILABLE.replace('{itens}', itemLines)

    /**
     * Manda primeiro, marca depois.
     *
     * Se marcasse antes e o envio falhasse, o pedido ficaria com "cliente avisado" sobre um recado que
     * ninguém recebeu — e ninguém descobriria. Na ordem inversa, o pior caso é a marca falhar depois de o
     * cliente já ter sido avisado: a tela continua oferecendo avisar, alguém clica de novo e ele recebe
     * duas mensagens. Mensagem repetida incomoda; cliente sem aviso perde a compra.
     */
    await this.dependencies.notifyCustomer({ whatsappNumber: detail.order.customerPhone, body })

    try {
      await this.dependencies.orderRepository.markUnavailableItemsNotified(params.orderId)
    } catch (error: unknown) {
      useCaseLog.error('notification_not_stamped', { orderId: params.orderId, error: serializeError(error) })
    }

    const updated = await this.dependencies.orderRepository.findDetailById(params.orderId)
    return { detail: updated ?? detail, notifiedCount: pending.length }
  }
}
