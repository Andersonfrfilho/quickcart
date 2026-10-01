/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Recota sempre que o carrinho, o tipo de entrega ou o CEP mudam (a chave inclui os três) — o
 * preço exibido nunca pode ficar preso a um carrinho antigo (spec §3.4, T2.2) nem a um endereço
 * velho (spec §3.5, T4.1).
 *
 * Entrega sem CEP completo não dispara a query: não há o que cotar, e a tela mostra
 * "Informe o CEP para calcular a taxa" em vez de bater na rota com um corpo que o schema recusaria.
 */

import { useQuery } from '@tanstack/react-query'
import { getCheckoutQuote } from '@/shared/api/client'
import type { CheckoutQuoteInput } from '@/shared/api/api.types'

const CEP_DIGITS_LENGTH = 8

/**
 * Extraído da hook para ser testável sem renderizar um componente (não há `renderHook` neste
 * projeto) — a regra em si (entrega só dispara com 8 dígitos de CEP) é o que os testes cobrem.
 */
export function resolveCheckoutQuoteRequest(input: CheckoutQuoteInput): {
  readonly cepDigits: string
  readonly enabled: boolean
  readonly body: CheckoutQuoteInput
} {
  const cepDigits = (input.cep ?? '').replace(/\D/g, '')
  const hasCompleteCep = cepDigits.length === CEP_DIGITS_LENGTH
  const isDeliveryReady = input.deliveryType !== 'delivery' || hasCompleteCep

  return {
    cepDigits,
    enabled: input.items.length > 0 && isDeliveryReady,
    body: { ...input, cep: hasCompleteCep ? cepDigits : undefined },
  }
}

export function useCheckoutQuoteQuery(input: CheckoutQuoteInput) {
  const { cepDigits, enabled, body } = resolveCheckoutQuoteRequest(input)

  return useQuery({
    queryKey: ['checkout-quote', input.deliveryType, cepDigits, input.items],
    queryFn: () => getCheckoutQuote(body),
    enabled,
  })
}
