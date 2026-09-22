/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'

export type AskCashChangeAgainParams = {
  readonly session: ConversationSession
  readonly cartId: string
  readonly checkoutContext: ConversationContext
  readonly deliveryFeeInCents: number
}
