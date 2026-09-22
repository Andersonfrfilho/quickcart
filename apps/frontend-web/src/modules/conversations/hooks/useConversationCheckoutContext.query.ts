/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { useQuery } from '@tanstack/react-query'

import { adminGetConversationCheckoutContext } from '@/shared/api/client'
import {
  CONVERSATION_CHECKOUT_CONTEXT_QUERY_KEY,
  ORDER_IN_PROGRESS_REFETCH_INTERVAL_MS,
} from '@/modules/conversations/shared/orderInProgress.constant'

export function useConversationCheckoutContextQuery(whatsappNumber: string) {
  return useQuery({
    queryKey: [CONVERSATION_CHECKOUT_CONTEXT_QUERY_KEY, whatsappNumber],
    queryFn: async () => (await adminGetConversationCheckoutContext(whatsappNumber)).data,
    refetchInterval: ORDER_IN_PROGRESS_REFETCH_INTERVAL_MS,
  })
}
