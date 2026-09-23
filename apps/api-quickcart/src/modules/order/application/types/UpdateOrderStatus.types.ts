/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { OrderRecord } from '@/modules/order/domain/OrderRepository.interface'
import type { OrderActor } from '@/modules/order/domain/orderStatusFlow'
import type { DeliveryFailureReason, OrderStatus } from '@/modules/order/shared/Order.constant'

export type UpdateOrderStatusParams = {
  readonly orderId: string
  readonly status: OrderStatus
  /**
   * Obrigatório ao registrar ocorrência, proibido no resto — quem garante isso é o schema da rota.
   *
   * Ocorrência sem motivo seria um pedido parado sem ninguém saber se espera outra tentativa ou o
   * cancelamento, e é o motivo (não o status) que decide isso.
   */
  readonly deliveryFailureReason?: DeliveryFailureReason | undefined
  /**
   * Em nome de quem a transição está sendo pedida. Omitido é `staff`, que é o painel.
   *
   * Só quem age pelo cliente passa `customer`, e é o que faz a esteira recusar o cancelamento de uma
   * sacola já separada — a verificação é aqui e não na tela, porque o botão escondido não protege
   * rota nenhuma (`security.md` §8).
   */
  readonly actor?: OrderActor
}

export type UpdateOrderStatusResult = {
  readonly order: OrderRecord
}
