/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { ConversationHandlerContext } from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'

export type AcceptCashChangeAmountParams = {
  readonly session: ConversationHandlerContext['session']
  readonly customer: ConversationHandlerContext['customer']
  readonly checkoutContext: ConversationContext
  readonly cashChangeForInCents: number
}
