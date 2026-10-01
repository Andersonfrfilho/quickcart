/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Não há coluna nova para isto: `payment_method = card_on_delivery` já significa "levar a
 * máquina" (roteiro §11, spec §3.2). Esta é a ÚNICA função que decide o fato — painel e
 * motorista consomem o resultado, nunca recalculam.
 */

import { DELIVERY_TYPE, PAYMENT_METHOD } from '@/modules/order/shared/Order.constant'

export function requiresCardMachine(order: { readonly paymentMethod: string; readonly deliveryType: string }): boolean {
  return order.paymentMethod === PAYMENT_METHOD.CARD_ON_DELIVERY && order.deliveryType === DELIVERY_TYPE.DELIVERY
}
