/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A taxa que vale para o checkout em andamento, lida SÓ do contexto. Entrega sem cotação por faixa
 * (sessão de antes do deploy, ou endereço ainda não informado) devolve `undefined` — nunca 0: taxa
 * inventada é entrega grátis, e quem chama decide voltar ao endereço.
 */

import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { DELIVERY_TYPE } from '@/modules/order/shared/Order.constant'

export function resolveCheckoutDeliveryFeeInCents(context: ConversationContext): number | undefined {
  if (context.checkoutDeliveryType !== DELIVERY_TYPE.DELIVERY) return 0
  if (context.checkoutDeliveryLocationSource === undefined) return undefined
  return context.checkoutDeliveryFeeInCents
}
