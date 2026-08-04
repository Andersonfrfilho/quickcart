/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Esconde do menu as opções que dependem de compra anterior, para quem ainda não comprou.
 *
 * "🔁 Repetir minha última compra" e "📜 Minhas últimas compras" só fazem sentido com histórico.
 * Oferecê-las a quem chegou agora é prometer o que não existe: a pessoa toca, ouve que não há pedido
 * anterior, e a partir daí lê o menu inteiro com desconfiança — um item que mentiu contamina os
 * outros. Menu curto e verdadeiro vale mais que menu completo.
 *
 * Uma consulta por exibição de menu (`findLastByCustomer`), que é o mesmo custo que a ação de repetir
 * já pagava depois. A diferença é que agora paga antes, para não precisar recusar.
 */

import type { CustomerRepositoryInterface } from '@/modules/webhook/domain/CustomerRepository.interface'
import type { OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import { MENU_BUTTON_ID } from '@/modules/conversation/shared/Messages.constant'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const filterLog = logger.child('MenuOptionsFilter')

/** Opções que só existem para quem já fechou pedido. */
const HISTORY_DEPENDENT_OPTION_IDS: ReadonlySet<string> = new Set([
  MENU_BUTTON_ID.REPEAT_ORDER,
  MENU_BUTTON_ID.ORDER_HISTORY,
])

export type MenuOptionsFilterDependencies = {
  readonly customerRepository: CustomerRepositoryInterface
  readonly orderRepository: OrderRepositoryInterface
}

export type MenuOptionsFilterParams = {
  readonly whatsappNumber: string
  readonly options: readonly (readonly [string, string])[]
}

export function createMenuOptionsFilter(dependencies: MenuOptionsFilterDependencies) {
  return async function filterMenuOptions({
    whatsappNumber,
    options,
  }: MenuOptionsFilterParams): Promise<readonly (readonly [string, string])[]> {
    // Nó sem opção dependente de histórico não paga consulta nenhuma.
    const hasHistoryDependentOption = options.some(([id]) => HISTORY_DEPENDENT_OPTION_IDS.has(id))
    if (!hasHistoryDependentOption) return options

    try {
      const customer = await dependencies.customerRepository.findByPhone(whatsappNumber)
      const lastOrder = customer ? await dependencies.orderRepository.findLastByCustomer(customer.id) : undefined
      if (lastOrder) return options

      return options.filter(([id]) => !HISTORY_DEPENDENT_OPTION_IDS.has(id))
    } catch (error: unknown) {
      // Falha de leitura não pode engolir o menu: sem menu a conversa morre, e com uma opção a mais o
      // pior caso é a ação dizer que não encontrou pedido anterior — que é o comportamento de antes.
      filterLog.warn('history_check_failed', { error: serializeError(error) })
      return options
    }
  }
}
