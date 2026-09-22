/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Recota sempre que o carrinho ou o tipo de entrega mudam (a chave inclui os dois) — o preço
 * exibido nunca pode ficar preso a um carrinho antigo (spec §3.4, T2.2).
 */

import { useQuery } from '@tanstack/react-query'
import { getCheckoutQuote } from '@/shared/api/client'
import type { CheckoutQuoteInput } from '@/shared/api/api.types'

export function useCheckoutQuoteQuery(input: CheckoutQuoteInput) {
  return useQuery({
    queryKey: ['checkout-quote', input.deliveryType, input.items],
    queryFn: () => getCheckoutQuote(input),
    enabled: input.items.length > 0,
  })
}
