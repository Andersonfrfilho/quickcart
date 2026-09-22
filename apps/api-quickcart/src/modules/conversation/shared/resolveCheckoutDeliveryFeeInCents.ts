/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A taxa do checkout é a que foi cotada ao escolher a entrega (`checkoutDeliveryFeeInCents`).
 * Sessão iniciada antes do deploy não tem a chave: cair em 0 daria entrega grátis quando a taxa
 * estiver ligada, então cota na hora com a taxa configurada.
 */

import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { resolveDeliveryFeeInCents } from '@/modules/order/shared/amountDue'

export type ResolveCheckoutDeliveryFeeInCentsParams = {
  readonly context: ConversationContext
  readonly configuredFeeInCents: number
}

export function resolveCheckoutDeliveryFeeInCents(params: ResolveCheckoutDeliveryFeeInCentsParams): number {
  const { context, configuredFeeInCents } = params
  if (context.checkoutDeliveryFeeInCents !== undefined) return context.checkoutDeliveryFeeInCents
  if (!context.checkoutDeliveryType) return 0
  return resolveDeliveryFeeInCents({ deliveryType: context.checkoutDeliveryType, configuredFeeInCents })
}
