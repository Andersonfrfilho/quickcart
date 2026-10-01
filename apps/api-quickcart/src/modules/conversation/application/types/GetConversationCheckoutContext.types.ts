/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { z } from 'zod'

import type { CHECKOUT_CONTEXT_RESPONSE_SCHEMA } from '@/modules/conversation/shared/CheckoutContext.schema'

export type GetConversationCheckoutContextParams = {
  readonly whatsappNumber: string
}

export type ConversationCheckoutContext = z.infer<typeof CHECKOUT_CONTEXT_RESPONSE_SCHEMA>

/** `undefined` = sem pedido em andamento, que é estado normal da conversa e não erro. */
export type GetConversationCheckoutContextResult = ConversationCheckoutContext | undefined
